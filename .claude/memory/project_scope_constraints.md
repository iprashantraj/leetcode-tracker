---
name: LeetCodeTracker scope constraints
description: User confirmed target scale - ~50 users on Supabase free tier. All design decisions should fit this budget.
type: project
originSessionId: 0549dd88-73ad-4a5d-8d42-3b826b871dca
---
Target scale: **~50 heavy users on Supabase free tier indefinitely** (3-5 problems/day each).

**Why:** User stated on 2026-05-16 that this is the expected audience and they want to stay free forever. They explicitly asked all future decisions be made with this constraint. User later clarified users will be heavier than moderate.

**Retention policy chosen:** events table auto-cleans after 90 days via pg_cron job. Keeps event storage at ~110 MB steady state. attempts table is kept forever (it's aggregate, small).

**How to apply:** Whenever proposing a new feature or design choice, sanity-check it against:
- 500 MB database storage (have ~5 years runway at projected event volume)
- 50K MAU limit (irrelevant at 50)
- 5 GB egress/month
- Unlimited API requests on free tier
- 7-day idle auto-pause (not a concern with 50 active users)

**Things that are fine at this scale:**
- Granular event logging (run + submit + verdicts) — already calculated ~85 MB/year for 50 users
- Per-row updates / inserts at any frequency
- Adding new tables, indexes, columns
- Real-time subscriptions for a handful of channels

**Things to avoid / push back on:**
- Full-text search via pg_trgm/tsvector indexes on large columns (storage-heavy)
- Storing large blobs (uploaded screenshots, code dumps) in Postgres or Supabase Storage
- pg_cron jobs that scan whole tables frequently (compute on free tier is limited)
- Materialized views that get refreshed often
- Subscribing to realtime on tables with rapid churn
- Suggesting features that need Supabase Pro ($25/mo) — user wants $0 forever

If a feature would push us close to limits at 50 users, propose alternatives (e.g., periodic cleanup jobs, archival).
