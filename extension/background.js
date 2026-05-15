// Service worker — authoritative state for attempts, persistence, and Supabase sync.

import { syncAttempts, syncEvents, isSignedIn } from "./supabase.js";

const SESSION_GAP_MS = 30 * 60 * 1000;     // 30 min idle → finalize the attempt
const LIVE_SYNC_ALARM = "live-sync";

// slug -> live attempt
const liveAttempts = new Map();

// Unsynced event log. Each entry: { id, attemptId, slug, eventType, occurredAt, metadata, synced }.
let eventBuffer = [];

// Single shared promise — every entry point awaits this so we never operate
// on an empty in-memory map after a service-worker restart.
let loadPromise = null;
async function _doLoad() {
  const { __live, __events } = await chrome.storage.local.get(["__live", "__events"]);
  if (__live) {
    let migrated = false;
    for (const [k, v] of Object.entries(__live)) {
      if (!v.id) { v.id = crypto.randomUUID(); migrated = true; }
      liveAttempts.set(k, v);
    }
    if (migrated) await saveLive();
  }
  if (Array.isArray(__events)) eventBuffer = __events;
}
function ensureLoaded() {
  if (!loadPromise) loadPromise = _doLoad();
  return loadPromise;
}

async function saveLive() {
  const obj = {};
  for (const [k, v] of liveAttempts.entries()) obj[k] = v;
  await chrome.storage.local.set({ __live: obj });
}
async function saveEvents() {
  await chrome.storage.local.set({ __events: eventBuffer });
}

function attemptKey(id) { return `attempt:${id}`; }

function liveToRecord(live) {
  const activeMs = live.activeMs + (live.activeSince ? Date.now() - live.activeSince : 0);
  return {
    id: live.id,
    slug: live.slug,
    title: live.title,
    startedAt: live.startedAt,
    endedAt: live.lastSeenAt,
    activeSeconds: Math.round(activeMs / 1000),
    runCount: live.runCount,
    submitCount: live.submitCount,
    solved: live.solved,
    solvedAt: live.solvedAt || null,
  };
}

function pushEvent(attemptId, slug, eventType, occurredAt, metadata = {}) {
  eventBuffer.push({
    id: crypto.randomUUID(),
    attemptId,
    slug,
    eventType,
    occurredAt,
    metadata,
    synced: false,
  });
}

async function getOrStartAttempt(slug, now, title) {
  let live = liveAttempts.get(slug);
  if (live && now - live.lastSeenAt > SESSION_GAP_MS) {
    await flushAttempt(slug);
    live = null;
  }
  if (!live) {
    live = {
      id: crypto.randomUUID(),
      slug,
      title: title || slug,
      startedAt: now,
      lastSeenAt: now,
      activeMs: 0,
      activeSince: null,
      runCount: 0,
      submitCount: 0,
      solved: false,
      solvedAt: null,
    };
    liveAttempts.set(slug, live);
  } else if (title && (live.title === live.slug || !live.title)) {
    live.title = title;
  }
  return live;
}

async function flushAttempt(slug) {
  const live = liveAttempts.get(slug);
  if (!live) return;
  if (live.activeSince) {
    live.activeMs += Date.now() - live.activeSince;
    live.activeSince = null;
  }
  const record = liveToRecord(live);
  await chrome.storage.local.set({ [attemptKey(record.id)]: record });
  liveAttempts.delete(slug);
  await saveLive();
  syncAttempts([record]).catch(err => console.warn("[tracker] flush sync failed:", err.message));
}

async function handle(msg, _sender) {
  if (!msg || !msg.slug) return;
  await ensureLoaded();
  const now = msg.ts || Date.now();
  const live = await getOrStartAttempt(msg.slug, now, msg.title);
  live.lastSeenAt = now;

  switch (msg.type) {
    case "PROBLEM_OPEN":
      break;
    case "PROBLEM_CLOSE":
      if (live.activeSince) {
        live.activeMs += now - live.activeSince;
        live.activeSince = null;
      }
      break;
    case "ACTIVE":
      if (!live.activeSince) live.activeSince = now;
      break;
    case "INACTIVE":
      if (live.activeSince) {
        live.activeMs += now - live.activeSince;
        live.activeSince = null;
      }
      break;
    case "RUN":
      live.runCount += 1;
      pushEvent(live.id, live.slug, "run", now);
      await saveEvents();
      break;
    case "SUBMIT":
      live.submitCount += 1;
      pushEvent(live.id, live.slug, "submit", now);
      await saveEvents();
      break;
    case "RUN_RESULT":
      pushEvent(
        live.id, live.slug,
        msg.accepted ? "run_accepted" : "run_rejected",
        now,
        { verdict: msg.verdict || null }
      );
      await saveEvents();
      break;
    case "SUBMIT_RESULT":
      if (msg.accepted && !live.solved) {
        live.solved = true;
        live.solvedAt = now;
      }
      pushEvent(
        live.id, live.slug,
        msg.accepted ? "submit_accepted" : "submit_rejected",
        now,
        { verdict: msg.verdict || null }
      );
      await saveEvents();
      break;
  }
  await saveLive();
}

async function syncLiveAttempts() {
  await ensureLoaded();
  if (!(await isSignedIn())) return;
  // Attempts first so events can reference an existing attempt id.
  if (liveAttempts.size) {
    const records = Array.from(liveAttempts.values()).map(liveToRecord);
    try {
      await syncAttempts(records);
    } catch (e) {
      console.warn("[tracker] live sync failed:", e.message);
      return; // don't push events if attempts failed
    }
  }
  const unsynced = eventBuffer.filter(e => !e.synced);
  if (unsynced.length === 0) return;
  try {
    await syncEvents(unsynced);
    for (const e of unsynced) e.synced = true;
    // Keep only the last 100 synced events to bound storage.
    eventBuffer = eventBuffer.filter(e => !e.synced).concat(
      eventBuffer.filter(e => e.synced).slice(-100)
    );
    await saveEvents();
  } catch (e) {
    console.warn("[tracker] event sync failed:", e.message);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender).then(() => sendResponse({ ok: true }));
  return true;
});

chrome.runtime.onStartup.addListener(ensureLoaded);
chrome.runtime.onInstalled.addListener(ensureLoaded);

chrome.alarms.create(LIVE_SYNC_ALARM, { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === LIVE_SYNC_ALARM) syncLiveAttempts();
});

ensureLoaded();
