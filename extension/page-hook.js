// Runs in the LeetCode page's MAIN world (same window as the page's own JS).
// Hooks fetch + XHR so we can observe the network calls LeetCode makes when
// you Run or Submit, regardless of which keyboard shortcut or button you use.
//
// Communicates back to the (isolated-world) content script via window.postMessage.
// No extra Chrome permissions needed — works purely from host_permissions for
// leetcode.com.

(function () {
  if (window.__leetTrackerHooked) return;
  window.__leetTrackerHooked = true;

  const RUN_RE = /\/problems\/([^/]+)\/interpret_solution\/?$/;
  const SUBMIT_RE = /\/problems\/([^/]+)\/submit\/?$/;

  function classify(url) {
    if (typeof url !== "string") return null;
    if (!url.includes("leetcode.com")) return null;
    let m;
    if ((m = RUN_RE.exec(url))) return { action: "RUN", slug: m[1] };
    if ((m = SUBMIT_RE.exec(url))) return { action: "SUBMIT", slug: m[1] };
    return null;
  }

  function report(action, slug) {
    window.postMessage(
      { source: "leetcode-tracker", action, slug, ts: Date.now() },
      window.location.origin
    );
  }

  // fetch hook
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
    const method = ((args[1] && args[1].method) || (args[0] && args[0].method) || "GET").toUpperCase();
    if (method === "POST") {
      const c = classify(url);
      if (c) report(c.action, c.slug);
    }
    return origFetch.apply(this, args);
  };

  // XHR hook
  const OrigXHR = window.XMLHttpRequest;
  const origOpen = OrigXHR.prototype.open;
  OrigXHR.prototype.open = function (method, url) {
    if (typeof method === "string" && method.toUpperCase() === "POST") {
      const c = classify(url);
      if (c) report(c.action, c.slug);
    }
    return origOpen.apply(this, arguments);
  };
})();
