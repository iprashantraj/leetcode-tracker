---
name: Deferred features for LeetCodeTracker
description: Features the user explicitly chose to defer in the May 16 polish round - involves LeetCode GraphQL fetching
type: project
originSessionId: 0549dd88-73ad-4a5d-8d42-3b826b871dca
---
User wants these features eventually but explicitly deferred them when scoping the polish round on 2026-05-16. They asked to be reminded later.

**Why:** Each of these needs problem metadata (difficulty + topics) that we don't have. The plan is to fetch from LeetCode's GraphQL endpoint in the content script (rate-limit-safe since it uses the user's own session), then upsert into the `problems` table.

**How to apply:** When the user opens a new conversation about this project or asks "what's left", surface these items. They are not in the current todo list, only in this memory.

Deferred items:
1. Fetch problem difficulty + topics from LeetCode GraphQL in the extension content script
2. Profile-style solved badges showing Easy/Medium/Hard counts on the dashboard
3. Topic skill breakdown chart (time per topic — DP, Array, Graph, etc.) on the dashboard
4. Problem list view with difficulty pills + topic chips on the dashboard
5. Extension settings/options page (idle threshold, blur grace knobs)

Items being shipped this round (NOT deferred): dark LeetCode theme, real toolbar icons, Accepted-vs-Rejected detection via DOM observation (not GraphQL).
