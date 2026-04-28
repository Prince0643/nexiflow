# API Traffic Scoping Findings (Code-Only Review)

Date: 2026-04-28

This note captures a **static (code-only)** review of Nexiflow’s API endpoints that are likely “not properly scoped” for traffic—i.e., endpoints that can return **unbounded result sets**, are **likely polled frequently**, or do **expensive work per request**.

Source reviewed: `api/index.js`

---

## What “Not Properly Scoped” Means Here

An endpoint is considered “not properly scoped” for traffic if it:

- Returns potentially large datasets without `limit/offset` pagination
- Defaults to “all history” (especially time-series data) when no filters are provided
- Is a “status” endpoint that’s likely polled, but returns more than the minimum required
- Uses `SELECT *` (wider payload + more IO) where only a subset of fields is needed

---

## High-Risk Endpoints (Likely to Cause Excess Traffic)

### 1) `GET /api/admin/time-entries`

Why risky:
- Builds a query starting from `SELECT * FROM time_entries ... ORDER BY start_time DESC`
- **No `LIMIT/OFFSET`**
- If used for admin dashboards, it can return a very large dataset for active companies

Impact:
- High DB load (large scans/sorts)
- Large response payloads
- Increased latency under concurrent usage

Recommended fix:
- Add `limit` + `offset` (defaults + hard max)
- Default to a date window (e.g., last 30 days) when no `startDate/endDate` supplied
- Replace `SELECT *` with explicit columns used in the response

---

### 2) `GET /api/time-entries/user/:userId` (and legacy alias `/api/time_entries/user/:userId`)

Why risky:
- Executes:
  - `SELECT * FROM time_entries WHERE user_id = ? ORDER BY start_time DESC`
- **No `LIMIT/OFFSET`**
- Easy to call repeatedly for “My Entries” screens and pull “all time”

Impact:
- Unbounded per-user history fetch
- Large JSON payload + serialization overhead

Recommended fix:
- Add pagination (`limit/offset`)
- Add optional date filters
- Consider gating heavy fields (e.g., tags parsing) behind a query flag (e.g., `includeTags=true`)

---

### 3) `GET /api/time-entries`

Why risky:
- If no date filters are provided, it can return a user’s full time-entry history
- **No `limit/offset` pagination**

Impact:
- Over-fetch on initial loads
- Frequently re-fetched data across sessions

Recommended fix:
- Add pagination
- Default to a date window when no `startDate/endDate`

---

### 4) `GET /api/admin/time-entries/running`

Why risky:
- “running entries” endpoints are commonly **polled**
- Current behavior can return *all* running entries (optionally per company), **no `LIMIT`**

Impact:
- High request rate × non-trivial payload

Recommended fix:
- Add a small per-user rate limit / throttle
- Add `limit` (and possibly `since=` / `updatedSince=` filters)
- Return only fields needed for a “running timers” widget (slimmer row shape)

---

## General Fix Strategy (Implementation Later)

### A) Standardize pagination on list endpoints

Add `limit` + `offset` to list endpoints, with:
- Defaults: `limit=50`, `offset=0`
- Hard max: `limit<=200` (clamp or reject consistently)

Response shape (suggested):
- `success: true`
- `data: [...]`
- `count: data.length`
- `limit`, `offset`
- Optional: `total` (only if you choose to run `COUNT(*)`; otherwise omit)

### B) Default date windows for time-series endpoints

For time entry list endpoints:
- If neither `startDate` nor `endDate` is provided, default to last **30 days** (or last 7 days if you want more aggressive reduction).

### C) Replace `SELECT *` with explicit columns

Benefits:
- Less IO from MySQL
- Smaller payloads
- More stable response contract over schema changes

### D) Gate “expensive extras” behind query flags

Examples:
- Only parse and return tags if `includeTags=true`
- Only include client/project names if requested (or fetched via joins only when needed)

### E) Add lightweight instrumentation (so we can prove hotspots)

Add a small, low-risk instrumentation layer:
- Per-request timing (endpoint + status code + duration)
- Slow request log threshold (e.g., >500ms)
- Optional per-query timing wrapper around `connection.execute`

Goal:
- Identify the true top endpoints by:
  - request volume
  - latency
  - response size
  - slow query frequency

---

## Next Step When You’re Ready

When you want to implement:
- I’ll add pagination + defaults to:
  - `/api/admin/time-entries`
  - `/api/time-entries`
  - `/api/time-entries/user/:userId`
  - `/api/admin/time-entries/running`
- Then we can add instrumentation to verify actual traffic + DB impact.

