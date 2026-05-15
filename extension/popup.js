// Popup — reads chrome.storage.local and renders state. Handles sign in / out.

import { isSignedIn, currentUser, signIn, signUp, signOut, isConfigured } from "./supabase.js";

const $ = sel => document.querySelector(sel);

function fmtDuration(seconds) {
  if (!seconds) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

function liveActiveSeconds(live) {
  let ms = live.activeMs;
  if (live.activeSince) ms += Date.now() - live.activeSince;
  return Math.round(ms / 1000);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

async function renderAuth() {
  const status = $("#auth-status");
  const section = $("#auth-section");

  if (!isConfigured()) {
    status.textContent = "config missing";
    section.hidden = true;
    return;
  }

  if (await isSignedIn()) {
    const u = await currentUser();
    status.innerHTML = `
      <span class="signed-in">● ${escapeHtml(u?.email || "signed in")}</span>
      <button id="signout-btn">Sign out</button>
    `;
    $("#signout-btn").addEventListener("click", async () => {
      await signOut();
      renderAuth();
    });
    section.hidden = true;
  } else {
    status.textContent = "signed out";
    section.hidden = false;
  }
}

function showError(msg) {
  const el = $("#auth-error");
  el.textContent = msg;
  el.hidden = !msg;
}
function showInfo(msg) {
  const el = $("#auth-info");
  el.textContent = msg;
  el.hidden = !msg;
}

async function withButtons(fn) {
  const btns = document.querySelectorAll("#auth-form button");
  btns.forEach(b => b.disabled = true);
  try { await fn(); } finally { btns.forEach(b => b.disabled = false); }
}

async function handleSignIn(e) {
  e?.preventDefault();
  showError(""); showInfo("");
  await withButtons(async () => {
    try {
      await signIn($("#auth-email").value, $("#auth-password").value);
      await renderAuth();
    } catch (err) {
      showError(err.message || "Sign in failed");
    }
  });
}

async function handleSignUp() {
  showError(""); showInfo("");
  await withButtons(async () => {
    try {
      const data = await signUp($("#auth-email").value, $("#auth-password").value);
      if (data.access_token || data.session?.access_token) {
        await renderAuth();
      } else {
        showInfo("Check your email to confirm your account, then sign in.");
      }
    } catch (err) {
      showError(err.message || "Sign up failed");
    }
  });
}

async function renderData() {
  const all = await chrome.storage.local.get(null);
  const live = all.__live || {};
  const liveEntries = Object.values(live);

  const currentEl = $("#current-body");
  if (liveEntries.length === 0) {
    currentEl.textContent = "No active problem.";
    currentEl.classList.add("muted");
  } else {
    const cur = liveEntries.sort((a, b) => b.lastSeenAt - a.lastSeenAt)[0];
    currentEl.classList.remove("muted");
    currentEl.innerHTML = `
      <div class="problem-title">${escapeHtml(cur.title || cur.slug)}</div>
      <div class="stats">
        <div class="stat"><span class="stat-value">${fmtDuration(liveActiveSeconds(cur))}</span><span class="stat-label">Active</span></div>
        <div class="stat"><span class="stat-value">${cur.runCount}</span><span class="stat-label">Runs</span></div>
        <div class="stat"><span class="stat-value">${cur.submitCount}</span><span class="stat-label">Submits</span></div>
      </div>
    `;
  }

  const recentList = $("#recent-list");
  const attempts = Object.entries(all)
    .filter(([k]) => k.startsWith("attempt:"))
    .map(([, v]) => v)
    .sort((a, b) => b.endedAt - a.endedAt)
    .slice(0, 10);

  recentList.innerHTML = attempts.length
    ? attempts.map(a => `
      <li>
        <span class="slug">${escapeHtml(a.title || a.slug)}</span>
        <span class="meta">${fmtDuration(a.activeSeconds)} · ${a.submitCount}↑</span>
      </li>
    `).join("")
    : `<li class="muted">No attempts yet.</li>`;
}

$("#auth-form").addEventListener("submit", handleSignIn);
$("#signup-btn").addEventListener("click", handleSignUp);

renderAuth();
renderData();
setInterval(renderData, 1000);
