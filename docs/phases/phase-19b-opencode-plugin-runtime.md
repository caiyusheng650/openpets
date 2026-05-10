# Phase 19B — OpenCode Plugin Runtime

## Goal

Add the OpenCode runtime plugin that turns OpenCode activity into OpenPets reactions and short safe speech.

This phase builds on Phase 19A's foundation package and shared speech validation. It should make the plugin importable/testable and ready for manual OpenCode config, but it should not add Desktop UI or `openpets configure --agent opencode` yet.

## Non-goals

- No Desktop Integrations OpenCode card.
- No CLI `configure --agent opencode` setup flow.
- No writes to real user OpenCode config.
- No OpenCode source changes under `v1/opencode/`.
- No new public MCP tools.
- No external SSE watcher or new TCP/HTTP listener.
- No pet install/remove/default controls.

## User-visible/manual outcome

Developers can manually add the plugin to an OpenCode config and see OpenPets react to OpenCode activity.

Expected manual plugin spec shape:

```jsonc
{
  "plugin": [
    ["@open-pets/opencode", { "pet": "fixer" }]
  ]
}
```

For local development, a file URL or absolute built plugin path can be used after build, but app/desktop setup is still deferred.

## Acceptance criteria

- `@open-pets/opencode` exposes an OpenCode-compatible server plugin entrypoint.
- Package export contract supports OpenCode's loader expectations:
  - npm package can resolve a server plugin entrypoint through an explicit package export such as `./server` without replacing the helper `.` export;
  - default export is an object with `server()`;
  - file/local plugin entry includes a stable `id`;
  - built output can be dynamically imported in tests;
  - package-level resolution of `@open-pets/opencode/server` is covered by tests.
- Plugin options accept:
  - optional `pet` id using the same strict pet id validation as Claude/OpenCode foundation;
  - optional debug flag or rely on `OPENPETS_DEBUG=1`.
- Plugin hooks must return immediately. OpenPets IPC work must run fire-and-forget and never be awaited by OpenCode plugin hooks.
- The `event` hook must be a synchronous non-throwing wrapper. OpenCode calls `event` with `void hook.event(...)` and does not await/catch it, so `event` must catch synchronous errors and schedule async work internally.
- OpenPets calls must be best-effort:
  - catch all errors internally;
  - debug-only sanitized logging;
  - short client timeouts;
  - never throw back into OpenCode.
- If `pet` is configured, plugin reactions/speech should acquire or reuse an OpenPets lease and pass `leaseId` to `react`/`say`.
- Lease handling must not block OpenCode hooks. It can be a cached in-flight/background lease or per-event fire-and-forget acquisition, but hook functions themselves must remain synchronous or already-resolved async functions.
- Event mapping must cover:
  - `chat.message` → `thinking` + throttled speech.
  - `tool.execute.before` edit/write/patch tool names → `editing`.
  - `tool.execute.before` shell/bash tool names with test-like command/category when safely inferable → `testing`.
  - `tool.execute.before` shell/bash tool names otherwise → `running`.
  - other non-OpenPets tools → `working`.
  - plugin `event` with `permission.asked` → `waiting` + approval-needed speech.
  - plugin `event` with `session.status` idle, if stable and useful → `success` sparingly.
  - plugin `event` with `session.error` → `error`.
- The plugin must ignore OpenPets MCP tool calls to avoid self-reaction loops, including likely OpenCode MCP tool names such as:
  - `openpets_openpets_status`
  - `openpets_openpets_say`
  - `openpets_openpets_react`
- Speech must use shared `@open-pets/agent-events` validation and message pools.
- Speech must not include prompt text, command text, tool args, tool output, code, logs, file paths, URLs, or secrets.
- Throttling for OpenCode speech must be namespaced separately from Claude, e.g. `opencode-hook-throttle.json` or equivalent.
- Tests cover event classification, speech safety, self-tool suppression, fire-and-forget behavior, import shape, and failure swallowing.

## Proposed files/directories

Likely changed/new files:

- `packages/opencode/package.json`
- `packages/opencode/src/plugin.ts`
- `packages/opencode/src/opencode-plugin-runtime.ts`
- `packages/opencode/src/check-opencode-plugin.ts`
- `packages/opencode/src/index.ts`
- `packages/opencode/src/check-opencode-foundation.ts`

Possible shared utility additions:

- `packages/agent-events/src/index.ts` for reusable throttling primitives, if needed.

## Technical approach

### OpenCode plugin contract

From `v1/opencode`:

- Plugin config specs are strings or `[string, options]`: `v1/opencode/packages/opencode/src/config/plugin.ts` lines 12-17.
- Plugin loader imports the resolved module and reads the default export: `v1/opencode/packages/opencode/src/plugin/loader.ts` lines 118-128.
- A server plugin must default-export an object with a `server()` function: `v1/opencode/packages/opencode/src/plugin/shared.ts` lines 272-303.
- File plugins need an `id`: `v1/opencode/packages/opencode/src/plugin/shared.ts` lines 306-316.
- Hook type surface includes `event`, `chat.message`, `tool.execute.before`, `tool.execute.after`, and `command.execute.before`: `v1/opencode/packages/plugin/src/index.ts` lines 222-333.

Implementation should export something compatible with:

```ts
export default {
  id: "open-pets-opencode",
  server: async (_input, options) => ({
    "chat.message": () => { /* schedule, return immediately */ },
    "tool.execute.before": () => { /* schedule, return immediately */ },
    event: () => { /* sync non-throwing schedule wrapper */ },
  }),
};
```

The exact TypeScript types can be local structural types to avoid adding a heavy dependency on OpenCode internals. If `@opencode-ai/plugin` is added as a dev/type dependency, it must not introduce runtime/package issues.

### Hook latency rule

OpenCode awaits plugin hooks in several paths:

- `Plugin.trigger` awaits hook promises: `v1/opencode/packages/opencode/src/plugin/index.ts` lines 258-269.
- Tool execution calls `tool.execute.before` before running tools: `v1/opencode/packages/opencode/src/session/prompt.ts` lines 428-433.

Therefore every plugin hook must schedule OpenPets work and then return immediately. Do not `await client.react`, `await client.say`, or `await client.acquireLease` directly inside a hook.

Use a small scheduler/helper such as:

```ts
function fireAndForget(work: () => Promise<void>): void {
  void work().catch(debugLog);
}
```

Hook functions may be `async` for OpenCode compatibility, but they must not await the scheduled work.

Exception: the `event` hook should not be `async`, because OpenCode does not await/catch it.

### OpenPets client behavior

Use `createOpenPetsClient({ connectTimeoutMs: 500, responseTimeoutMs: 500 })` or a similarly short timeout.

When `pet` is configured:

- Acquire a lease in the background.
- Cache the lease id while valid if simple.
- Use the lease id for `say`/`react` once available.
- If lease acquisition fails, fall back to default target or no lease without surfacing errors.

### Event classification

Keep classification pure and testable.

Proposed pure functions:

- `classifyOpenCodeToolReaction(toolName, args): OpenPetsReaction | undefined`
- `classifyOpenCodeBusEvent(event): { reaction?, speechCategory?, forceSpeech? } | undefined`
- `shouldIgnoreOpenPetsTool(toolName): boolean`

Tool classification should rely on tool names and safe coarse categories. It may inspect a shell command only to decide whether it looks test-like, and must never send the command text to speech.

Expected tool name patterns:

- edit/write/patch: names containing `edit`, `write`, `patch`, `apply_patch`.
- shell/bash: names containing `bash`, `shell`, `terminal`, or OpenCode's shell tool id if known.
- OpenPets MCP tools: suppress names ending in or equal to `openpets_status`, `openpets_say`, `openpets_react`, including server-prefixed forms.

Bus event classification:

- `permission.asked` from permission bus → `waiting`, `permission` speech.
- `session.error` → `error` speech category.
- `session.status` with idle may map to `success`, but avoid noisy success spam by throttling.

### Speech/throttling

Use shared messages and validator from `@open-pets/agent-events`.

OpenCode speech categories should match Claude categories for now:

- `thinking`
- `success`
- `error`
- `permission`

Throttle storage must be separate from Claude. If file-backed throttling is added in this phase, it must use only OpenCode-specific path names and best-effort writes.

## Risks and tradeoffs

- OpenCode plugin APIs may evolve; keep plugin-specific runtime isolated in `packages/opencode`.
- Fire-and-forget scheduling avoids blocking OpenCode but means pet reactions may be dropped if Node exits immediately.
- Lease caching adds state; if too complex, prefer simple background per-event lease acquisition for correctness.
- Mapping session idle to success may be noisy. It should be throttled or omitted if unstable during implementation.
- Adding runtime client dependency to `@open-pets/opencode` is expected in this phase; avoid depending on CLI or desktop.

## Security/privacy notes

- Never send prompt text, command text, tool args, tool output, code, logs, file paths, URLs, or secrets to pet speech.
- Debug logging must sanitize paths and secrets.
- Plugin must ignore OpenPets MCP tools to avoid loops.
- Plugin must catch all OpenPets client errors.
- No new local server, TCP listener, or HTTP endpoint is added.
- `pet` option must be strictly validated before use.

## Test/check plan

- `pnpm --filter @open-pets/opencode check`
- `pnpm --filter @open-pets/agent-events check`
- `pnpm --filter @open-pets/claude check`
- `pnpm check` after implementation review fixes.

Specific tests:

- Dynamic import of built plugin entry returns default object with `id` and `server()`.
- Dynamic import of package export `@open-pets/opencode/server` returns default object with `id` and `server()`.
- `server()` returns hooks for `chat.message`, `tool.execute.before`, and `event`.
- Hook calls schedule work and return before a deliberately unresolved fake client promise completes.
- `event` hook is synchronous, non-throwing, and does not produce unhandled rejections when classification/scheduling fails.
- OpenPets client errors are swallowed.
- Configured pet id is validated; invalid pet option fails plugin setup safely.
- `chat.message` maps to `thinking` without using prompt text.
- edit/write/patch tools map to `editing`.
- shell/bash test-like tools map to `testing`; non-test shell maps to `running`.
- OpenPets MCP tools are ignored.
- `permission.asked` maps to `waiting` + permission speech.
- `session.error` maps to `error`.
- Speech validator rejects unsafe generated messages.
- Throttle state is OpenCode-namespaced if implemented.

## Manual verification guide

After implementation and review:

1. Run `pnpm --filter @open-pets/opencode check`.
2. Run `pnpm check`.
3. Start OpenPets desktop locally.
4. Build packages.
5. Manually add the local built OpenCode plugin to a test OpenCode project config.
6. Start OpenCode in that test project.
7. Submit a prompt and confirm the selected/default pet reacts with `thinking`.
8. Run an edit/write action and confirm `editing`.
9. Run a test-like shell action and confirm `testing`.
10. Trigger a permission request if practical and confirm `waiting` / approval speech.
11. Confirm OpenPets MCP tool calls do not trigger recursive reactions.
12. Confirm no prompt text, command text, file path, or tool output appears in pet speech.

## Oracle plan review

Oracle reviewed the initial Phase 19B spec and found two plan blockers:

- Package export contract needed to explicitly support OpenCode's `./server` entry resolution while preserving helper exports.
- The `event` hook must not be `async`/rejecting because OpenCode invokes it with `void hook.event(...)` and does not await/catch it.

## Oracle feedback disposition

- **Fixed:** Added explicit `@open-pets/opencode/server` export requirement and package-level import test.
- **Fixed:** Required `event` to be synchronous, non-throwing, and internally catch/schedule async work.
