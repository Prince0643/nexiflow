# Time Tracker — Bug Audit

**Date:** 2026-11-05
**Scope:** Time tracker UI, data services, context, admin edit/stop modals, and the timer API helpers.
**Files reviewed:**
- `src/pages/TimeTracker.tsx`
- `src/components/TimeTracker.tsx`
- `src/services/timeEntryService.ts`
- `src/services/timeEntryApiService.ts`
- `src/contexts/TimeEntryContext.tsx`
- `src/components/admin/TimeEntryEditModal.tsx`
- `src/components/admin/StopTimerModal.tsx`
- `api/timerReminderScheduler.js`
- `api/aiTimerIntent.cjs`

**Method:** Static read of the real code. Findings are concrete (file + line + how it fails). Three items marked "verify server" depend on backend behavior not in these files — they are the highest-value things to confirm first because they flip between SEV2 and SEV1.

Severity: **SEV1** = data loss / wrong money / wrong duration. **SEV2** = broken feature or tenant/correctness. **SEV3** = minor / robustness.

---

## SEV1 — data loss, wrong money, wrong duration

### 1. `parseDuration` writes `NaN` on any non-`HH:MM:SS` input
`src/components/admin/TimeEntryEditModal.tsx:112`
The duration field is free-text. `"1:30"` → `parts[2]` undefined → `NaN`; `"abc"` → all `NaN`. The `NaN` is PUT to the server and into optimistic state, then every total that sums `entry.duration` becomes `NaN`, corrupting today/week/month and any invoice derived from it.
**Fix:** validate/clamp; reject non-numeric or non-three-part input; never send `NaN`.

### 2. Duration not re-derived from start/end on save
`src/components/admin/TimeEntryEditModal.tsx:161`
`handleSave` sends `startTime`, `endTime`, and `duration` independently. The auto-connect recompute only runs in `handleInputChange`, and `duration` is directly editable. Start 09:00 / end 10:00 with a hand-typed `05:00:00` duration all persist → displayed range and billed hours disagree.
**Fix:** derive `duration` from `endTime − startTime` on save (or make duration read-only when both times are present).

### 3. `datetime-local` round-trip shifts times by the UTC offset
`src/components/admin/TimeEntryEditModal.tsx:58`, `:131`, `:161`, `:174`
Load does `toISOString().slice(0,16)` (UTC wall-clock) into a `datetime-local` input, which the browser reads as **local**. Save parses it back as local and re-serializes. Net: opening and saving an unchanged entry moves its clock by the local offset (e.g. −8h in PST); edits compound; day-boundary bucketing then attributes entries to the wrong day.
**Fix:** convert UTC↔local explicitly for the input value, or store/display a single consistent zone.

---

## SEV2 — broken feature / correctness / tenant

### 4. Stop-modal data is silently dropped
`src/services/timeEntryService.ts:87`, `StopTimerModal.tsx:80`
`stopTimeEntry` / `stopOtherUserTimeEntry` POST `/stop` with no body; the project/description/client the user enters in the stop modal are never persisted unless the caller separately calls `updateTimeEntry`.
**Fix:** send the `updates` through the stop call, or call `updateTimeEntry` before `stopTimeEntry` in the stop flow.

### 5. Double-start race (check-then-act)
`src/services/timeEntryService.ts:42`; also `TimeTracker.tsx:348` start guard uses stale closure state
`getRunningTimeEntry` then create are two round-trips with no lock. Double-click, two tabs, or the poller racing a manual start → two running entries; stopping one orphans the other and inflates logged time.
**Fix:** server-side unique constraint on "one running entry per user"; treat the client guard as advisory only.

### 6. Admin list filtering is client-side — possible tenant leakage over the wire
`src/services/timeEntryService.ts:16`, `:56`, `:169`
`getAllTimeEntries` hits the unscoped `GET /time-entries` and filters by company in the browser. If that endpoint isn't server-scoped to `companyId`, every company's entries ship to the client and are merely hidden. **SEV1 if the endpoint is unscoped.**
**Fix (verify first):** confirm server scoping; pass and enforce `companyId` server-side.

### 7. Editing a running entry silently finalizes it
`src/components/admin/TimeEntryEditModal.tsx:50`, `:59`, `:174`
Opening the edit modal on a running entry pre-fills `endTime = now` and computes a duration; saving writes a concrete end + duration, stopping the timer through the edit path while running-state may stay inconsistent elsewhere.
**Fix:** detect running entries; don't default `endTime`; route stopping through the stop flow.

---

## SEV3 — minor / robustness

8. **Duration unit (seconds vs ms) is unvalidated across the boundary** — `TimeEntryEditModal.tsx:105`, `timeEntryApiService.ts:338`. Becomes SEV1 if the server ever stores ms. Add an explicit contract/guard.
9. **Client can be dropped on save** — `TimeEntryEditModal.tsx:55`,`:66`. `clientId` is blanked on load and only re-inferred from the project; entries with a direct client lose it on save.
10. **`new Date(undefined)` → Invalid Date** — `timeEntryApiService.ts:131`,`:187`,`:211`; `timeEntryService.ts:31`. Guard missing `createdAt`/`updatedAt`.
11. **AI intent regex false-positives** — `api/aiTimerIntent.cjs:5`. `/\bstop\b[\s\w]*\btime\b/` matches "stop wasting time", "finish on time"; no start/stop precedence. Could stop a real timer. Tighten patterns; require explicit timer context.
12. **Scheduler reports success on partial failure** — `api/timerReminderScheduler.js:51`. Exits 0 while `failedCount > 0`; monitoring never sees the failures. Treat non-zero `failedCount` as non-success.
13. **Poller overwrites optimistic edits; loading can stick** — `TimeEntryContext.tsx:45`; service pollers. An in-flight poll can revert a just-saved edit for up to one interval; if every poll throws, `loading` stays true forever. Key optimistic writes against poll responses; clear `loading` in a `finally`.

---

## Also found directly in the tracker UI (page/component)

- **Billable "$ earned" freezes while the timer runs** — `src/pages/TimeTracker.tsx:198` sums `entry.duration` (last saved) while the card shows live elapsed from `getDisplayDurationSeconds`; the money figure and the visible clock disagree. **SEV2.**
- **Billable time vs. $ earned use different windows/zones** — `TimeTracker.tsx:183` recomputes client-side with browser `startOfDay`, while the stat cards come from the server summary; they can diverge. **SEV2.**
- **Pagination hides pages past 5** — `TimeTracker.tsx:491` caps page buttons at 5, but `Next` advances beyond it; pages 6+ are unreachable except via the arrow and the active-page highlight breaks. **SEV2.**
- **`startTime <= now` drops future/clock-skewed entries** from the billable sum silently — `TimeTracker.tsx:191`. **SEV3.**
- **Non-solo `isBillable` default read before company loads** — `TimeTracker.tsx:37`. **SEV3.**

---

## Recommended first three to verify (they gate the rest)
1. Is `GET /time-entries` server-scoped to the caller's company? (item 6 — SEV1 if not)
2. Does `/time-entries/{id}/stop` enforce owner/tenant? (item 4)
3. Is `duration` stored in seconds everywhere? (items 1, 2, 8)

Answering these three turns a dozen "possible" items into a precise, ordered fix list.
