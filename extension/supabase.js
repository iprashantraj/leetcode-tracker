// Thin wrapper around Supabase Auth + PostgREST.
// We use fetch directly (no SDK) so this works in MV3 service workers
// without a bundler.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const SESSION_KEY = "__session";

function configured() {
  return SUPABASE_URL && SUPABASE_URL.startsWith("https://")
    && !SUPABASE_URL.includes("YOUR_PROJECT_REF")
    && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes("YOUR_");
}

async function getSession() {
  const { [SESSION_KEY]: s } = await chrome.storage.local.get(SESSION_KEY);
  return s || null;
}

async function setSession(s) {
  if (s) await chrome.storage.local.set({ [SESSION_KEY]: s });
  else await chrome.storage.local.remove(SESSION_KEY);
}

function withExpiry(data) {
  return { ...data, expires_at: Date.now() + (data.expires_in || 3600) * 1000 };
}

async function api(path, opts = {}) {
  if (!configured()) throw new Error("Supabase not configured — edit extension/config.js");
  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    ...(opts.headers || {}),
  };
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...opts, headers });
  let body = null;
  const text = await res.text();
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = (body && (body.error_description || body.msg || body.message)) || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export async function isSignedIn() {
  const s = await getSession();
  return !!(s && s.access_token);
}

export async function currentUser() {
  const s = await getSession();
  return s?.user || null;
}

export async function signUp(email, password) {
  const data = await api("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  // If email confirmation is enabled, data.session may be null and user must confirm.
  if (data.access_token) await setSession(withExpiry(data));
  else if (data.session?.access_token) await setSession(withExpiry(data.session));
  return data;
}

export async function signIn(email, password) {
  const data = await api("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await setSession(withExpiry(data));
  return data;
}

export async function signOut() {
  const s = await getSession();
  if (s?.access_token) {
    try {
      await api("/auth/v1/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${s.access_token}` },
      });
    } catch (_) { /* ignore */ }
  }
  await setSession(null);
}

async function accessToken() {
  const s = await getSession();
  if (!s) return null;
  if (Date.now() < s.expires_at - 60_000) return s.access_token;
  try {
    const data = await api("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    const merged = withExpiry({ ...s, ...data });
    await setSession(merged);
    return data.access_token;
  } catch (e) {
    // refresh failed — clear session
    await setSession(null);
    return null;
  }
}

// Upsert one or more attempt rows. Records use the live-attempt shape from background.js.
export async function syncAttempts(records) {
  if (!records.length) return;
  const token = await accessToken();
  if (!token) return;
  const s = await getSession();
  // Skip malformed records (missing id) — PostgREST bulk insert requires
  // every row to have the exact same set of keys.
  const rows = records
    .filter(r => r && r.id && r.slug && r.startedAt)
    .map(r => ({
      id: r.id,
      user_id: s.user.id,
      problem_slug: r.slug,
      problem_title: r.title || r.slug,
      started_at: new Date(r.startedAt).toISOString(),
      ended_at: new Date(r.endedAt || r.lastSeenAt).toISOString(),
      active_seconds: r.activeSeconds ?? Math.round((r.activeMs || 0) / 1000),
      run_count: r.runCount || 0,
      submit_count: r.submitCount || 0,
      solved: !!r.solved,
      solved_at: r.solvedAt ? new Date(r.solvedAt).toISOString() : null,
    }));
  if (!rows.length) return;
  await api("/rest/v1/attempts?on_conflict=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
}

export const isConfigured = configured;
