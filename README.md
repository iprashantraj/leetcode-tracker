# LeetCode Tracker

A Chrome extension that tracks time spent on LeetCode problems, plus a web dashboard with stats, charts, and a friends-and-leaderboard social layer. Everything syncs through Supabase.

## What's inside

| Folder | What it is |
|---|---|
| `extension/` | Manifest V3 Chrome extension — tracks problem time, run/submit clicks, syncs to Supabase every 60s |
| `dashboard/` | Vite + React app — stats bar, daily activity chart, calendar heatmap, recent attempts, friends, leaderboard |
| `supabase/` | SQL migrations — schema, RLS policies, helper functions |

## Stack

- **Extension:** Manifest V3, vanilla JS, ES modules
- **Backend:** Supabase (Postgres + Auth + Row Level Security)
- **Dashboard:** React 18, Vite, Recharts, date-fns
- **Hosting:** Vercel (dashboard), Supabase (backend), local dev mode (extension)

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. SQL Editor → paste `supabase/schema.sql` → Run.
3. Then `supabase/phase4.sql` → Run.
4. Then `supabase/phase4_usernames.sql` → Run.
5. Authentication → Providers → Email → toggle **Confirm email** OFF (optional, easier testing).
6. Project Settings → API → copy the **Project URL** and **anon / public** key.

### 2. Extension

1. Copy `extension/config.example.js` to `extension/config.js`.
2. Paste your Supabase URL + anon key into `config.js`.
3. Chrome → `chrome://extensions` → Developer mode on → **Load unpacked** → select `extension/`.
4. Pin the extension. Open any `leetcode.com/problems/*` page. The popup shows live stats.

### 3. Dashboard (local dev)

```bash
cd dashboard
cp .env.example .env
# Edit .env and paste your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Visit `http://localhost:5173`. Sign up with the same email you used in the extension (or any new email).

### 4. Dashboard (deploy)

The dashboard is a static site. Deploy from this repo:

- **Vercel:** New project → import this repo → set env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` → deploy. Auto-redeploys on every push.
- Or **Render / Netlify / Cloudflare Pages**: build command `npm run build`, output dir `dist`.

## Features

- ⏱️ Active-time tracking with focus / visibility / 3-min idle handling
- 🔘 Run / Submit click detection (incl. keyboard shortcuts)
- ☁️ Auto-sync to Supabase every 60 seconds
- 📊 Daily activity line chart (comparison-ready)
- 🟩 GitHub-style calendar heatmap
- 🔥 Current + longest streaks
- 👥 Friend search, requests, accept/decline
- 🏆 Leaderboard by time / problems / submits / streak
- 📈 Friend comparison overlay on the activity chart

## Privacy / data model

- Each user only sees their own attempts unless they're friends with the owner.
- Attempt events stay on-device until the periodic sync flushes a finalized attempt.
- The `anon` Supabase key is safe to expose in client code — Row Level Security policies in `supabase/` enforce all access rules at the database layer.
