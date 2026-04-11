# AI Agentic Implementation Plan

## Summary
- Convert `POST /api/ai/chat` into a server-side tool-calling agent loop.
- V1 scope: timer tools + read-only project/client lookup tools.
- Preserve existing frontend contract (`{ prompt, history }` in, `{ success, reply }` out).
- Enforce stop-timer rule: `clientId`, `projectId`, and non-empty `description` must exist before stopping.

## Implementation Changes
- Backend (`api/index.js`):
  - Replace single completion call with iterative tool loop.
  - Add tool safeguards: max tool steps, tool timeout, unknown-tool fail-closed behavior.
  - Keep auth/rate limit behavior unchanged.
- Tool registry (server-side allowlist):
  - `get_running_timer()`
  - `list_projects({ search? })`
  - `list_clients({ projectId?, search? })`
  - `update_running_timer({ projectId?, clientId?, description? })`
  - `stop_running_timer()`
- Tool handler rules:
  - Scope all queries/actions to authenticated `req.user`.
  - Never trust model-provided `userId`.
  - `stop_running_timer` returns `MISSING_REQUIRED_FIELDS` when required fields are incomplete.
  - Assistant asks only for missing values, then updates running timer, then retries stop.
- Prompt policy updates:
  - Use tools for timer/project/client operations.
  - Do not invent IDs.
  - No confirmation required for explicit stop intent.

## API / Contract Notes
- Keep endpoint: `POST /api/ai/chat`.
- Keep request shape: `{ prompt, history }`.
- Keep response minimum: `{ success: true, reply: string }`.
- Optional metadata (non-breaking): `meta.toolCallsUsed`, `meta.truncatedByMaxSteps`.

## Test Plan
- Stop timer with complete fields: stops successfully.
- Stop timer with missing fields: asks for missing fields only, then stops after user provides data.
- No running timer: clear user-facing response.
- Project/client lookup tools: return only user/company-scoped records.
- Invalid tool name/arguments: safe failure, no server crash.
- Regular informational prompts: still return normal assistant responses.

## Assumptions
- Active backend AI route is in `api/index.js`.
- V1 scope is timer + read-only lookup only (no task/project mutations).
- Required fields for stopping timer are aligned with current app behavior (`clientId`, `projectId`, `description`).
