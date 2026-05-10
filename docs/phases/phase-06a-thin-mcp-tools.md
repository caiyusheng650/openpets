# Phase 06A: Thin `@open-pets/mcp` tools over local IPC

## Goal

Make OpenPets minimally usable from MCP-capable coding agents through a thin Node/npm/npx MCP server package over the existing Phase 05 local IPC methods.

This sub-phase turns the Phase 05 local IPC control plane into the first agent-facing integration:

```text
MCP-capable agent → @open-pets/mcp stdio server → @open-pets/client → desktop local IPC → visible pet
```

## Non-goals

- Claude Code config detection/setup UI.
- Claude enhanced hooks.
- Agent Setup window implementation.
- Pet install/remove/default tools exposed to agents.
- Remote HTTP/TCP MCP server.
- Full packaging/release publishing.
- Complex session/project routing.
- Advanced animation engine.
- Direct app auto-install. MCP may try to launch an installed app later, but must not install it.

## User-visible/manual outcome

After this phase, a developer can run the local `@open-pets/mcp` package as a stdio MCP server, call:

```text
openpets_status
openpets_say
openpets_react
```

and see the running OpenPets desktop pet respond through local IPC.

If OpenPets is not running, the MCP server remains alive and `openpets_status` reports a clear degraded/unavailable status instead of crashing.

This phase is explicitly **not** the full Phase 06 lease lifecycle. Full real `--pet` routing, non-default temporary pet windows, lease heartbeat/release, fallback for missing explicit pets, and TTL cleanup are split into follow-up Phase 06B.

## Acceptance criteria

- `@open-pets/mcp` builds and runs with Node/npm/pnpm and is shaped for future `npx -y @open-pets/mcp` usage.
- Package has a `bin` entry and compiled entrypoint has a Node shebang.
- MCP server uses stdio transport and never writes logs to stdout.
- MCP server exposes exactly these initial tools:
  - `openpets_status`
  - `openpets_say`
  - `openpets_react`
- `openpets_status` calls `@open-pets/client.status()` and reports reachable/degraded app state as both human-readable text and structured content where supported.
- `openpets_say` calls `@open-pets/client.say()` with the user-provided short message and optional reaction.
- `openpets_react` calls `@open-pets/client.react()` with one allowed reaction.
- MCP tool schemas enforce the public reaction list from `task.txt`.
- MCP tool schemas keep `openpets_say.message` short enough for Phase 05 IPC limits and speech safety.
- Tool errors return MCP tool errors (`isError: true`) rather than crashing the server.
- If desktop app/discovery/local IPC is unavailable, `openpets_status` reports degraded state clearly.
- If desktop app/discovery/local IPC is unavailable, `openpets_say` and `openpets_react` return clear tool errors.
- No tool can install pets, remove pets, set default pet, browse catalog, edit settings, access filesystem, run shell commands, or expose generic IPC.
- `--pet <id>` is parsed and included in MCP status/config output.
- `--pet` is clearly reported as configured-but-not-yet-routed in Phase 06A; actual tools still affect the desktop app's current default pet through Phase 05 IPC.
- `openpets_status` clearly distinguishes `configuredPetId` from `actualTargetPetId`.
- If `--pet` is omitted, status reports that the MCP server targets the user's current default pet.
- MCP process lifecycle handlers close the MCP server cleanly on `SIGINT`/`SIGTERM` where available.
- No Bun runtime requirement.
- Automated checks cover MCP argument parsing, tool input validation helpers, and degraded status formatting where practical.

## Scope note: Phase 06A versus 06B

The high-level Phase 06 target in `docs/implementation-process.md` includes immediate lease acquire/release, `--pet` opening explicit non-default pets, fallback for missing explicit pets, and TTL cleanup.

Current implementation state after Phase 05 provides `hello`, `status`, `pet.react`, and `pet.say` over local IPC, but does not yet expose `lease.acquire`, `lease.heartbeat`, or `lease.release`, and the desktop app still has only a persistent default-pet window.

Oracle plan review required this split. This spec is Phase 06A:

```text
Phase 06A: thin MCP tools over default-pet IPC
Phase 06B: MCP lease lifecycle and explicit non-default pet windows
```

Do not silently expand Phase 06A into lease lifecycle work.

## Proposed files/directories

Expected additions/changes:

```text
docs/phases/phase-06a-thin-mcp-tools.md
packages/mcp/package.json
packages/mcp/src/index.ts
packages/mcp/src/args.ts
packages/mcp/src/tools.ts
packages/mcp/src/check-mcp-contract.ts
packages/mcp/tsconfig.json
packages/client/src/index.ts (only if minor client result typing is needed)
pnpm-lock.yaml
```

Exact file split may change if a simpler implementation is clearer.

## Technical approach

### MCP SDK

Use the stable official TypeScript MCP SDK for this npm/npx-facing package:

```text
@modelcontextprotocol/sdk
zod
```

Do not use alpha split SDK packages unless the stable SDK proves incompatible and the reason is documented.

### Server shape

- Entry file starts with `#!/usr/bin/env node`.
- `@open-pets/client`, `@modelcontextprotocol/sdk`, and the schema validation library are runtime dependencies when used by the MCP server.
- Create MCP server with name `open-pets` / package name `@open-pets/mcp`.
- Connect using stdio transport.
- Use stderr for diagnostics only.
- Keep stdout reserved for MCP protocol.
- Register three tools with small descriptions and schemas.
- Keep tool handlers pure/testable by injecting the client/status functions where practical.

### Tools

`openpets_status`:

- No required params.
- Returns app availability, configured `--pet` target if present, default-pet status from the desktop app, and guidance if unavailable.
- Should be safe/read-only/idempotent.
- Sanitizes degraded/unavailable errors before returning them to agents; do not expose home paths, socket paths, tokens, or raw Node stack details.

Structured status shape:

```ts
interface OpenPetsMcpStatus {
  ok: boolean;
  appRunning: boolean;
  configuredPetId?: string;
  actualTargetPetId?: string;
  actualTargetPetName?: string;
  usingDefaultPet: boolean;
  routingImplemented: false;
  unavailableReason?: string;
  fallbackReason?: string;
}
```

`openpets_react`:

Params:

```json
{
  "reaction": "testing"
}
```

Valid reactions:

```text
idle
thinking
working
editing
running
testing
waiting
success
error
celebrating
```

`openpets_say`:

Params:

```json
{
  "message": "Working on it",
  "reaction": "working"
}
```

Rules:

- Message max 140 characters.
- Single-line.
- No code-block-like content.
- No obvious secrets, URLs, or long path-like content.
- Optional reaction must be from the public reaction list.

The desktop IPC remains the final enforcement layer; MCP schemas are an early validation layer.

### CLI args

Parse only the initial simple args:

```text
--pet <petId>
--help
--version
```

Rules:

- Pet id uses the same safe id shape as catalog pets.
- Do not add `--agent` or `--workspace`.
- Do not make `--pet` silently install pets.
- For Phase 06A-style behavior, `--pet` is reported in status but may not yet open non-default pets until lease lifecycle is implemented.
- If `--pet` is provided, `openpets_status` must explicitly say explicit pet routing is not implemented in Phase 06A and the actual target remains the desktop default pet.

### Degraded behavior

`@open-pets/client.status()` already returns a typed unavailable result when discovery/connect fails. MCP should preserve this behavior in `openpets_status`.

For `say`/`react`, return `isError: true` with a concise message such as:

```text
OpenPets desktop app is not running or local IPC is unavailable. Open OpenPets and try again.
```

### Lifecycle

- Handle `SIGINT`/`SIGTERM` by closing MCP server/transport where supported.
- Keep server alive even if OpenPets desktop app is unavailable.
- Do not implement public `openpets_release`.

Phase 06B lease lifecycle must later:

- Acquire on MCP startup, not first tool call.
- Heartbeat while alive.
- Release on shutdown/signals/stdin close where practical.
- Use desktop TTL fallback for orphan cleanup.
- Fall back to default pet for missing explicit pet and report fallback in status.

## Risks and tradeoffs

### Risk: SDK API drift

Mitigation:

- Verify current official MCP TypeScript package before implementation.
- Keep SDK wrapper code small.
- Add package-local checks.

### Risk: stdout corruption

Mitigation:

- Never use `console.log` in MCP runtime path.
- Use stderr for diagnostics.

### Risk: scope creep into full lease/multi-pet lifecycle

Mitigation:

- Thin MCP tools over existing local IPC are the manually verifiable Phase 06A checkpoint.
- Lease lifecycle is explicitly Phase 06B.

### Risk: agents displaying private content through `openpets_say`

Mitigation:

- MCP schema limits message shape.
- Desktop IPC validates speech safety again.
- Tool descriptions explicitly say not to send code, logs, secrets, URLs, or file paths.

## Security/privacy notes

- MCP server is stdio only.
- No TCP/HTTP listener.
- No filesystem/shell/Electron access exposed to agents.
- Agent-facing tool surface stays minimal.
- Pet management remains user-controlled in the desktop app.
- `openpets_say` is for short status/personality messages only.
- No Bun runtime dependency.

## Test/check plan

Automated checks:

```bash
pnpm check
pnpm --filter @open-pets/mcp check
pnpm --filter @open-pets/mcp build
```

Phase 06A should add checks for:

- CLI arg parsing for `--pet`, `--help`, `--version`, invalid args.
- Reaction validation accepts only public reactions.
- `openpets_say` validation rejects overlong/multiline/code/secret/path/URL-like messages.
- Degraded status formatting when client reports unavailable.
- Built output has a shebang or package bin points at the expected executable.
- MCP contract check starts the stdio server and verifies `tools/list` returns exactly `openpets_status`, `openpets_say`, and `openpets_react`.
- Contract check verifies unavailable app does not crash the MCP server.
- Contract check verifies no unexpected stdout noise outside MCP protocol messages.

## Manual verification guide

1. Run desktop app:

   ```bash
   pnpm --filter @open-pets/desktop dev
   ```

2. Build MCP package:

   ```bash
   pnpm --filter @open-pets/mcp build
   ```

3. Run an MCP inspector or local MCP client against the package entrypoint.

4. Call `openpets_status` and confirm it reports OpenPets reachable/default pet info.

5. Call `openpets_react` with `testing` and confirm the visible pet reacts.

6. Call `openpets_say` with `Working on it` and `working` and confirm the visible pet message appears.

7. Quit OpenPets and call `openpets_status` again; confirm it reports degraded/unavailable clearly while MCP remains alive.

Manual acceptance question:

```text
Does Phase 06A pass on your machine: @open-pets/mcp runs over stdio, exposes status/say/react, talks to the running desktop app through local IPC, reports configured `--pet` as not-yet-routed, and reports degraded status when OpenPets is unavailable?
```

## Oracle plan review

Oracle reviewed the initial Phase 06 plan and blocked calling it complete Phase 06 because real lease lifecycle and `--pet` routing are larger cross-cutting desktop/client work. Oracle approved the architecture only as Phase 06A.

## Oracle feedback disposition

- Fixed: Renamed/split scope to Phase 06A thin MCP tools over local IPC.
- Fixed: Deferred lease lifecycle, real non-default `--pet` windows, heartbeat/release, fallback, and TTL cleanup to Phase 06B.
- Fixed: Required status/manual docs to clearly distinguish configured `--pet` from actual default-pet target in Phase 06A.
- Fixed: Switched SDK plan to stable `@modelcontextprotocol/sdk` instead of alpha split package.
- Fixed: Required runtime dependencies for `@open-pets/client`, MCP SDK, and schema validation library.
- Fixed: Promoted runtime dependency requirement into the package/server acceptance criteria.
- Fixed: Corrected expected spec path and Phase 06A check wording after rename.
- Fixed: Tightened package/npx acceptance: bin entry, shebang, executable compiled entry, no Bun, no stdout logs.
- Fixed: Defined structured MCP status shape.
- Fixed: Required sanitized degraded errors so local paths/tokens/raw Node details are not returned to agents.
- Fixed: Required MCP contract check for tool list, invalid inputs, unavailable app behavior, and stdout protocol cleanliness.
- Fixed: Clarified tool error semantics: unavailable app returns `isError: true` for say/react rather than crashing the server.
- Deferred: Auto-launch of installed OpenPets app is explicitly left for Phase 06B or packaging phase.

Implementation review disposition:

- Fixed: Replaced POSIX-only `chmod +x` build script with a Node-based post-build executable step that no-ops on Windows.
- Fixed: Replaced POSIX `X_OK` contract assertion with shebang/bin validation.
- Fixed: MCP package `check` builds `@open-pets/client` first so package-local checks do not depend on stale client `dist` output.
- Fixed: Added stdio smoke contract coverage using the built `dist/index.js`, verifying tool list and degraded `openpets_status` with a missing discovery file.
- Fixed: Unavailable `openpets_status` human text now still explains configured `--pet` and Phase 06A deferred routing.
