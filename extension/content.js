// Content script — runs on https://leetcode.com/problems/*
// Responsible for: detecting current problem, tracking user activity signals,
// observing Run/Submit clicks, and forwarding events to the background worker.

const IDLE_THRESHOLD_MS = 180_000;   // 3 min of no input = idle
const BLUR_GRACE_MS = 30_000;        // 30s after window blur before pausing

let currentSlug = null;
let lastInputAt = Date.now();
let idleTimer = null;
let blurTimer = null;
let isActive = false;

function getSlugFromUrl() {
  const m = location.pathname.match(/^\/problems\/([^/]+)/);
  return m ? m[1] : null;
}

function send(type, payload = {}) {
  try {
    chrome.runtime.sendMessage({ type, slug: currentSlug, ts: Date.now(), ...payload });
  } catch (_) {
    // Service worker may be cold — message will be retried on next event.
  }
}

function setActive(active, reason) {
  if (active === isActive) return;
  isActive = active;
  send(active ? "ACTIVE" : "INACTIVE", { reason });
}

function onInput() {
  lastInputAt = Date.now();
  if (document.visibilityState === "visible" && document.hasFocus()) {
    setActive(true, "input");
  }
  resetIdleTimer();
}

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => setActive(false, "idle"), IDLE_THRESHOLD_MS);
}

function onVisibilityChange() {
  if (document.visibilityState === "hidden") {
    setActive(false, "tab-hidden");
  } else if (document.hasFocus()) {
    setActive(true, "tab-visible");
    resetIdleTimer();
  }
}

function onFocus() {
  if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
  if (document.visibilityState === "visible") {
    setActive(true, "window-focus");
    resetIdleTimer();
  }
}

function onBlur() {
  if (blurTimer) clearTimeout(blurTimer);
  blurTimer = setTimeout(() => setActive(false, "window-blur"), BLUR_GRACE_MS);
}


// Listen for postMessage from page-hook.js (runs in main world, hooks the
// page's window.fetch / XHR). When LeetCode fires its Run/Submit network
// call we get notified here, forward to background, and start watching the
// DOM for the verdict text.
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== "leetcode-tracker") return;
  if (data.action !== "RUN" && data.action !== "SUBMIT") return;
  send(data.action);
  startVerdictWatch(data.action === "SUBMIT" ? "SUBMIT_RESULT" : "RUN_RESULT");
});

// After a Submit, watch the DOM for the verdict text. LeetCode renders the
// result in a panel that appears shortly after the submission completes.
const VERDICTS = [
  "Accepted",
  "Wrong Answer",
  "Time Limit Exceeded",
  "Memory Limit Exceeded",
  "Runtime Error",
  "Compile Error",
  "Output Limit Exceeded",
];

let verdictObserver = null;
let verdictTimer = null;

function cleanupVerdictWatch() {
  if (verdictObserver) verdictObserver.disconnect();
  verdictObserver = null;
  if (verdictTimer) clearTimeout(verdictTimer);
  verdictTimer = null;
}

function startVerdictWatch(resultType) {
  cleanupVerdictWatch();
  verdictObserver = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const text = (node.textContent || "").trim();
        if (!text) continue;
        for (const v of VERDICTS) {
          // Match on a short fragment so we don't catch unrelated long text.
          if (text.length < 2000 && text.includes(v)) {
            send(resultType, { verdict: v, accepted: v === "Accepted" });
            cleanupVerdictWatch();
            return;
          }
        }
      }
    }
  });
  verdictObserver.observe(document.body, { childList: true, subtree: true });
  verdictTimer = setTimeout(cleanupVerdictWatch, 60_000);
}

// LeetCode is an SPA — detect URL changes without a full page reload.
function watchUrlChanges() {
  let last = location.href;
  const check = () => {
    if (location.href !== last) {
      last = location.href;
      handleSlugChange();
    }
  };
  // Patch history methods + poll for safety.
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args) { origPush.apply(this, args); check(); };
  history.replaceState = function (...args) { origReplace.apply(this, args); check(); };
  window.addEventListener("popstate", check);
  setInterval(check, 1000);
}

function cleanTitle() {
  return document.title.replace(/\s*-\s*LeetCode\s*$/i, "").trim();
}

function handleSlugChange() {
  const newSlug = getSlugFromUrl();
  if (newSlug === currentSlug) return;
  if (currentSlug) send("PROBLEM_CLOSE");
  currentSlug = newSlug;
  if (currentSlug) {
    send("PROBLEM_OPEN", { title: cleanTitle() });
    if (document.visibilityState === "visible" && document.hasFocus()) {
      setActive(true, "open");
      resetIdleTimer();
    }
  }
}

function watchTitle() {
  // React often sets document.title after our initial PROBLEM_OPEN.
  // Re-send when it changes so the background can upgrade slug→real title.
  let lastTitle = "";
  const observe = () => {
    const t = cleanTitle();
    if (t && t !== lastTitle && currentSlug) {
      lastTitle = t;
      send("PROBLEM_OPEN", { title: t });
    }
  };
  const titleEl = document.querySelector("title");
  if (titleEl) {
    new MutationObserver(observe).observe(titleEl, { childList: true, characterData: true, subtree: true });
  }
  // Fallback: also poll briefly (some pages mount <title> late).
  let polls = 0;
  const poll = setInterval(() => { observe(); if (++polls > 10) clearInterval(poll); }, 500);
}

function init() {
  console.log("[tracker] content script loaded on", location.href);
  currentSlug = getSlugFromUrl();
  if (currentSlug) {
    send("PROBLEM_OPEN", { title: cleanTitle() });
    setActive(document.visibilityState === "visible" && document.hasFocus(), "init");
    resetIdleTimer();
  }
  watchTitle();
  ["keydown", "mousemove", "click", "scroll"].forEach(ev =>
    document.addEventListener(ev, onInput, { passive: true, capture: true })
  );
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("focus", onFocus);
  window.addEventListener("blur", onBlur);
  // Tab is being torn down (close, navigate away, browser quit). Fire INACTIVE
  // synchronously so the service worker doesn't keep an open active window.
  window.addEventListener("pagehide", () => setActive(false, "pagehide"));
  window.addEventListener("beforeunload", () => setActive(false, "beforeunload"));
  // Run/Submit detection now lives in the service worker (background.js)
  // via chrome.webRequest — works for any keyboard shortcut or button click.
  watchUrlChanges();
}

init();
