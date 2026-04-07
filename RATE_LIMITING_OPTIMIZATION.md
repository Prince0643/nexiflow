# Rate Limiting Optimization Notes

## Current limiter

Production API traffic is currently gated by a single general limiter in `api/index.js`:

```js
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 2000 : 100
});

app.use('/api/', limiter);
```

That means all `/api/*` requests share the same `100 requests / 15 minutes` bucket in production.

## Highest-priority endpoints to optimize

### 1. `GET /api/mention-notifications`

Why this matters:
- Notifications are the most likely cause of the recurring `429` reports.
- This endpoint is called from the mention notification polling flow and is also refreshed on focus / visibility changes.
- Even after slowing polling down, it still contributes to the same shared limiter bucket.

Relevant files:
- `src/services/mentionNotificationService.ts`
- `src/contexts/NotificationContext.tsx`
- `api/index.js`

Recommended optimizations:
- Keep polling conservative.
- Do not poll while the tab is hidden.
- Back off aggressively after `429`.
- Consider moving this route to its own limiter bucket with a higher ceiling than the global API limiter.
- Longer term: replace polling with websocket / SSE if notifications need to feel real-time.

### 2. `GET /api/tasks?projectId=...`

Why this matters:
- `TaskViewModal` polls every 5 seconds while open.
- One open modal at 5-second polling produces about `180 requests / 15 minutes`, which already exceeds the global production limit.

Relevant files:
- `src/components/taskManagement/TaskViewModal.tsx`
- `api/index.js`

Recommended optimizations:
- Increase poll interval substantially.
- Only poll while the modal is open and visible.
- Stop polling when no task updates are expected.
- Prefer fetching a single task endpoint instead of refetching the full task list for a project.
- Consider server-side event delivery for comments / notes updates.

### 3. `GET /api/admin/time-entries/running`

Why this matters:
- Admin dashboard refreshes running timers every 30 seconds.
- This is less aggressive than tasks and notifications, but it runs continuously for admin users.

Relevant files:
- `src/pages/AdminDashboard.tsx`
- `src/services/adminApiService.ts`
- `api/index.js`

Recommended optimizations:
- Only poll while the dashboard tab is visible.
- Skip polling when there are no running entries.
- Increase interval if real-time precision is not required.
- Consider a dedicated limiter bucket for admin dashboard polling endpoints.

### 4. `GET /api/time-entries/user/:userId/running`

Why this matters:
- Time tracker polls every 30 seconds to detect a running timer.
- This is not the top offender, but it adds steady background traffic.

Relevant files:
- `src/components/TimeTracker.tsx`
- `src/services/timeEntryApiService.ts`
- `api/index.js`

Recommended optimizations:
- Poll only when the user is on the time tracking screen.
- Pause polling on hidden tabs.
- Back off when no running entry exists.
- Consider caching the current running state client-side between polls.

### 5. `GET /api/admin/users`

Why this matters:
- User subscriptions poll every 30 seconds.
- By itself this is moderate, but it adds pressure to the shared limiter when used together with notifications and task polling.

Relevant files:
- `src/services/userService.ts`
- `src/services/userApiService.ts`
- `api/index.js`

Recommended optimizations:
- Poll only on screens that truly need live user updates.
- Pause in background tabs.
- Replace polling with explicit refresh for low-change views.

## Lower-priority endpoints

### `GET /api/billing/seat-limit`

Why lower priority:
- Appears to be a one-time load call, not a recurring poller.

Relevant file:
- `src/pages/AdminDashboard.tsx`

### `PUT /api/mention-notifications/:id/read`
### `PUT /api/mention-notifications/read-all`

Why lower priority:
- These are user-triggered, not continuous background requests.

## Recommended implementation order

1. Optimize `GET /api/tasks?projectId=...`
2. Optimize `GET /api/mention-notifications`
3. Split high-frequency routes into separate rate limit buckets
4. Optimize `GET /api/admin/time-entries/running`
5. Optimize `GET /api/time-entries/user/:userId/running`
6. Optimize `GET /api/admin/users`

## Suggested backend rate-limit strategy

Current problem:
- The global limiter is too small for a UI that uses multiple polling-based features at once.

Suggested direction:
- Keep the strict auth limiter for login/signup.
- Keep a general API limiter, but raise its production ceiling.
- Move polling-heavy routes into separate limiters:
  - notifications
  - task updates
  - running timers
  - admin live data

Example direction:
- General API limiter for regular CRUD traffic
- More permissive limiter for lightweight polling endpoints
- Per-route or grouped limiter for endpoints expected to be refreshed in the background

## Quick win summary

If only a few changes happen first, do these:

1. Fix task modal polling first because `5s` polling against the full task list is the worst current offender.
2. Give notifications their own rate-limit bucket instead of making them compete with all other `/api/*` traffic.
3. Pause all polling in hidden tabs.
4. Add exponential backoff after `429` on every polling client, not just notifications.
5. Revisit whether polling is even necessary for each screen.
