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

// Detect Run / Submit. The Run button is often icon-only (no visible text),
// so we check multiple signals: visible text, aria-label, title, data-e2e-locator,
// and presence of an SVG play icon. Submit is usually labelled outright.
function classifyButton(btn) {
  const text = (btn.innerText || btn.textContent || "").trim().toLowerCase();
  const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
  const title = (btn.getAttribute("title") || "").toLowerCase();
  const locator = (btn.getAttribute("data-e2e-locator") || "").toLowerCase();
  const combined = `${text} ${aria} ${title} ${locator}`;

  if (/\bsubmit\b/.test(combined)) return "SUBMIT";
  if (/\brun\b/.test(combined)) return "RUN";

  // Icon-only Run button: look for a "play" SVG. The Run button on LeetCode
  // is typically the only icon-only button near the editor — keep this loose.
  if (!text && btn.querySelector("svg")) {
    const cls = (btn.className || "") + " " + (btn.querySelector("svg")?.getAttribute("class") || "");
    if (/play|run/i.test(cls)) return "RUN";
  }
  return null;
}

function onClickCapture(e) {
  const btn = e.target.closest("button");
  if (!btn) return;
  const kind = classifyButton(btn);
  if (kind) send(kind);
}

// Keyboard shortcuts: Ctrl/Cmd+Enter = Run, Ctrl/Cmd+Shift+Enter = Submit.
// Most LeetCode regulars use these instead of clicking.
function onKeyDown(e) {
  if (e.key !== "Enter") return;
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.shiftKey) send("SUBMIT");
  else send("RUN");
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
  document.addEventListener("click", onClickCapture, true);
  document.addEventListener("keydown", onKeyDown, true);
  watchUrlChanges();
}

init();
