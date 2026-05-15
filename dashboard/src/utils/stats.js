// Pure aggregation helpers. No React, no Supabase — easy to test mentally.

import { startOfDay, format, differenceInCalendarDays, subDays, parseISO } from "date-fns";

export function fmtDuration(seconds) {
  if (!seconds) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export function dateKey(d) {
  return format(startOfDay(d), "yyyy-MM-dd");
}

// Aggregate attempts into per-day buckets for the activity chart.
// Returns an array of { date: "YYYY-MM-DD", activeSeconds, attempts, submits } sorted ascending.
// `days` is the lookback window; gaps are filled with zero rows so charts render flat.
export function dailyActivity(attempts, days = 30, refDate = new Date()) {
  const map = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const k = dateKey(subDays(refDate, i));
    map.set(k, { date: k, activeSeconds: 0, attempts: 0, submits: 0 });
  }
  for (const a of attempts) {
    if (!a.started_at) continue;
    const k = dateKey(parseISO(a.started_at));
    const row = map.get(k);
    if (!row) continue; // outside window
    row.activeSeconds += a.active_seconds || 0;
    row.attempts += 1;
    row.submits += a.submit_count || 0;
  }
  return Array.from(map.values());
}

// Sum to top-line numbers.
export function summary(attempts) {
  let totalSeconds = 0;
  let totalSubmits = 0;
  const slugs = new Set();
  for (const a of attempts) {
    totalSeconds += a.active_seconds || 0;
    totalSubmits += a.submit_count || 0;
    slugs.add(a.problem_slug);
  }
  return {
    totalSeconds,
    totalSubmits,
    problems: slugs.size,
    attempts: attempts.length,
  };
}

// Consecutive-day streak ending on (or yesterday-flexible from) today.
// Current streak: counts back from today (or yesterday if today empty).
// Longest streak: best run anywhere in history.
export function streaks(attempts, today = new Date()) {
  const activeDays = new Set();
  for (const a of attempts) {
    if (!a.started_at) continue;
    activeDays.add(dateKey(parseISO(a.started_at)));
  }
  if (activeDays.size === 0) return { current: 0, longest: 0 };

  // Sorted distinct dates
  const sortedDates = Array.from(activeDays).sort();
  let longest = 1, run = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = parseISO(sortedDates[i - 1]);
    const cur = parseISO(sortedDates[i]);
    if (differenceInCalendarDays(cur, prev) === 1) {
      run += 1; longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  // Current streak: walk back from today, allowing a single-day grace if today is empty.
  let current = 0;
  let cursor = today;
  if (!activeDays.has(dateKey(cursor))) cursor = subDays(cursor, 1);
  while (activeDays.has(dateKey(cursor))) {
    current += 1;
    cursor = subDays(cursor, 1);
  }
  return { current, longest };
}

// Per-day buckets for the heatmap (last N days, default 120).
export function heatmapData(attempts, days = 120, refDate = new Date()) {
  return dailyActivity(attempts, days, refDate);
}
