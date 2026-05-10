# Phase 06B: MCP lease lifecycle and explicit pet routing

## Goal

Complete the core MCP runtime behavior that Phase 06A intentionally deferred: MCP startup should acquire a desktop-app lease for the configured/default pet, explicit non-default `--pet` values should open temporary pet windows, leases should heartbeat while alive, and temporary explicit pets should close when their last active lease ends or expires.

This phase turns the Phase 06A thin tool path into the real agent-neutral lifecycle described in `task.txt`:

```text
@open-pets/mcp --pet snoopy starts
  → desktop app receives lease.acquire
  → snoopy window opens as temporary agent pet
  → tools target snoopy through lease id
  → MCP exits or crashes
  → release or TTL cleanup removes lease
  → snoopy closes if no other lease/user pin needs it
```

## Non-goals

- Claude Code detection/configuration UI.
- Claude enhanced hooks.
- Agent Setup window implementation.
- Auto-launching installed OpenPets desktop app from MCP.
- Production packaging/release validation.
- Pet install/remove/default tools exposed to agents.
- Complex agent/session/workspace routing beyond one target pet per MCP process.
- Remote HTTP/TCP MCP server.
- Advanced animation engine.

## User-visible/manual outcome

After this phase:

- Running `@open-pets/mcp` without `--pet` acquires a lease for the desktop default pet and tools affect the default pet.
- Running `@open-pets/mcp --pet <installed-non-default-id>` opens that installed pet as a temporary agent pet and tools affect that pet.
- Quitting the MCP process releases the lease.
- A temporary explicit non-default pet closes after the last active lease using it ends.
- If MCP crashes, desktop TTL cleanup expires the orphaned lease and closes the temporary pet.
- If `--pet` is missing or invalid/uninstalled, desktop falls back to the default pet and `openpets_status` reports the fallback clearly.

## Acceptance criteria

- Desktop local IPC adds internal methods:
  - `lease.acquire`
  - `lease.heartbeat`
  - `lease.release`
  - lease-scoped `pet.react`
  - lease-scoped `pet.say`
- `@open-pets/client` exposes typed helpers for acquiring, heartbeating, releasing, status, say, and react with optional lease id.
- `@open-pets/mcp` acquires a lease during startup after MCP server initialization, not on first tool call.
- `@open-pets/mcp --pet <id>` sends requested pet id to `lease.acquire`.
- `@open-pets/mcp` accepts a bounded raw `--pet` string and lets desktop validate/fallback; only values that exceed length/control-character limits are fatal CLI errors.
- Raw `--pet` CLI bound: UTF-8 byte length must be 1-128 bytes and must not contain control characters, NUL, path separators, or whitespace-only content. Values that pass this bound but are not safe pet ids are sent to desktop and become `invalid_pet_id` fallback.
- If `--pet` is omitted, lease acquisition targets the current desktop default pet.
- If explicit `--pet` is installed and not broken, desktop opens/shows that pet as a temporary explicit agent pet.
- If explicit `--pet` is missing, not installed, invalid, or broken, desktop falls back to built-in/current default pet and records fallback reason.
- `openpets_status` reports:
  - `configuredPetId`
  - `leaseId`
  - `actualTargetPetId`
  - `actualTargetPetName`
  - `usingDefaultPet`
  - `fallbackReason` when applicable
  - `routingImplemented: true`
- `openpets_say` and `openpets_react` target the acquired lease's actual pet.
- If lease acquisition fails because OpenPets is unavailable, MCP remains alive in degraded mode and `openpets_status` reports unavailable clearly.
- In degraded mode, `openpets_say` and `openpets_react` return MCP tool errors without crashing the server.
- MCP sends heartbeat while alive for an acquired lease.
- MCP releases its lease on graceful shutdown paths where practical:
  - `SIGINT`
  - `SIGTERM`
  - normal process exit path
  - stdio transport close when exposed by SDK/transport
- Desktop expires stale leases by TTL if MCP crashes or release is not delivered.
- Default pet remains persistent and is never auto-closed due to MCP lease release/expiry.
- Explicit non-default pet windows close after the last active lease for that pet ends/expires.
- Multiple MCP processes using the same explicit non-default pet keep one pet window open until all their leases end.
- Multiple MCP processes using the default pet do not close the default pet on release.
- Temporary explicit pet windows use local installed `spritesheet.webp` data URLs only; no remote images.
- Temporary explicit pet windows are draggable and basic-positioned without needing final multi-monitor polish.
- Operation is local-only; no TCP/HTTP.
- Public MCP tool set remains exactly `openpets_status`, `openpets_say`, `openpets_react`.
- No public MCP tool can install/remove/default pets, edit settings, access filesystem, run shell commands, or expose generic IPC.
- Automated checks cover lease state transitions, fallback behavior, TTL cleanup logic, and MCP status mapping.

## Proposed files/directories

Expected changes:

```text
docs/phases/phase-06b-mcp-lease-lifecycle.md
apps/desktop/src/local-ipc-protocol.ts
apps/desktop/src/local-ipc.ts
apps/desktop/src/lease-manager.ts
apps/desktop/src/agent-pet-controller.ts
apps/desktop/src/pet-window.ts
apps/desktop/src/default-pet-controller.ts
apps/desktop/src/app-state.ts (only if helper accessors are needed)
apps/desktop/src/check-lease-manager.ts
packages/client/src/index.ts
packages/client/src/protocol.ts
packages/client/src/check-client-protocol.ts
packages/mcp/src/index.ts
packages/mcp/src/tools.ts
packages/mcp/src/check-mcp-contract.ts
```

Exact file split may change if implementation reveals a simpler structure.

## Technical approach

### Lease model

Desktop app owns lease state in memory only. Leases are not persisted.

Recommended in-memory shape:

```ts
interface PetLease {
  leaseId: string;
  requestedPetId?: string;
  targetKind: "default" | "explicit";
  actualPetId: string;
  fallbackReason?: string;
  acquiredAt: number;
  lastHeartbeatAt: number;
  expiresAt: number;
}
```

Initial timing:

```text
heartbeat interval from MCP: 5 seconds
desktop lease TTL: 15 seconds
desktop cleanup interval: 5 seconds
```

Use generated random lease ids from desktop app. Do not trust client-provided lease ids for acquisition.

Target-kind rules:

- `targetKind: "default"` means tools route to the persistent default pet controller and release/expiry must never close the default pet.
- `targetKind: "explicit"` means tools route to a temporary explicit non-default pet window and release/expiry participates in explicit pet refcount cleanup.
- Fallback leases use `targetKind: "default"` even when the user requested an explicit pet.
- If the desktop default changes after a `targetKind: "default"` lease is acquired, that lease continues to target the live default controller. Status should report the live current default pet as actual target.

### Desktop target resolution

`lease.acquire` params:

```json
{
  "requestedPetId": "snoopy"
}
```

Resolution rules:

1. If no `requestedPetId`, actual pet is current default pet.
2. If requested pet is `builtin` or equals current default, actual pet is default pet and remains persistent. This check happens before installed-pet path helpers that reject `builtin`.
3. If requested pet exists, is installed, is not broken, and is not built-in/default, actual pet is requested pet and its temporary window opens.
4. If requested pet is missing/broken/invalid, actual pet is current default pet, `targetKind` is `default`, fallback reason is recorded, and status reports fallback.
5. If current default is somehow missing/broken, use built-in fallback.

Fallback reasons must be short machine-readable codes, not raw exception text or local paths:

```text
invalid_pet_id
pet_not_installed
pet_broken
default_broken_fallback_builtin
```

### IPC request/result contracts

`lease.acquire` result includes:

```json
{
  "leaseId": "random-id",
  "requestedPetId": "snoopy",
  "targetKind": "explicit",
  "actualTargetPetId": "snoopy",
  "actualTargetPetName": "Snoopy",
  "usingDefaultPet": false,
  "fallbackReason": null,
  "expiresAt": 1234567890
}
```

`lease.heartbeat` accepts `{ "leaseId": "random-id" }` and returns `{ "leaseId": "random-id", "expiresAt": 1234567890 }`. Unknown/expired lease heartbeat returns structured `unknown_lease` error and MCP marks context degraded/stale.

`lease.release` accepts `{ "leaseId": "random-id" }` and returns `{ "released": true }`. Release is idempotent for shutdown races; unknown/already-released leases return `{ "released": false }`.

`status` may accept `{ "leaseId": "random-id" }`. Known leases return target details. Unknown/expired leases return degraded/stale lease status without raw local errors.

Stale status shape:

```json
{
  "ok": false,
  "appRunning": true,
  "leaseId": "random-id",
  "leaseActive": false,
  "staleReason": "unknown_lease"
}
```

### Pet windows

Current default pet window remains controlled by `default-pet-controller.ts`.

Add a separate agent/leased pet controller for explicit non-default pets:

- One `BrowserWindow` per explicit non-default pet id.
- Window uses a safe rendering helper that takes an explicit pet id and reads only local installed `spritesheet.webp` as a data URL.
- Initial position offsets from the default pet/primary work area so temporary pets do not fully overlap.
- Windows are always-on-top/frameless/transparent like default pet.
- Temporary pet windows use `showInactive` / non-focus-stealing behavior like the default pet.
- Position persistence for temporary agent pets is not required in Phase 06B.
- Close temporary window when no active lease targets that pet.

Avoid storing remote URLs or absolute paths in durable state.

### Local IPC protocol

Extend Phase 05 request methods:

```text
lease.acquire
lease.heartbeat
lease.release
pet.react
pet.say
```

`pet.react` and `pet.say` should accept optional `leaseId`; without a lease id they keep Phase 05 default-pet behavior for backward compatibility.

Validation:

- Lease id must be a known active lease for lease-scoped say/react.
- Unknown/expired lease id returns structured error.
- Say/reaction safety validation remains enforced in desktop IPC.
- Request byte limits/token/version validation remain unchanged.

### Client package

Add typed client helpers:

```ts
client.acquireLease({ requestedPetId? })
client.heartbeatLease(leaseId)
client.releaseLease(leaseId)
client.status({ leaseId? })
client.react(reaction, { leaseId? })
client.say(message, { reaction?, leaseId? })
```

Keep existing Phase 05/06A call signatures backward-compatible where practical.

### MCP package

MCP startup flow:

1. Parse CLI args.
2. Create MCP server and register tools.
3. Start a shared lease-initialization promise before or during server connection.
4. Connect stdio transport.
5. Tool handlers await the shared lease-initialization promise before using lease state, so tools cannot race ahead of acquisition.
6. If acquire succeeds, store lease context and start heartbeat timer.
7. If acquire fails, remain in degraded mode.

Tool behavior:

- `openpets_status` reports lease/degraded state.
- `openpets_say`/`openpets_react` require an active lease to target explicit/default pet; if no lease, return `isError: true` with clear unavailable guidance.

Shutdown:

- Clear heartbeat timer.
- Best-effort `lease.release` if a lease exists.
- Close MCP server.
- Do not rely on async work in Node `exit`; signals and transport close are the practical release paths.
- Heartbeat timer should be `unref()` where available so it does not keep an otherwise-dead MCP process alive.
- Heartbeat failures must be caught; unknown lease responses mark context degraded/stale.
- Heartbeat timer should stop after unknown/stale lease to avoid repeated failures.

Do not write diagnostics to stdout.

### Auto-launch

Auto-launch of installed OpenPets desktop app remains deferred. It is important product behavior, but packaging/app discovery is not mature enough yet. Phase 06B focuses on lease lifecycle when the app is already running.

## Risks and tradeoffs

### Risk: phase grows into multi-pet architecture refactor

Mitigation:

- Keep Phase 06B to temporary explicit pet windows only.
- Do not implement user-pinned non-default pets beyond leases.
- Do not add persistent positions for temporary pets.
- Split again if full multi-pet manager changes become necessary.

### Risk: orphaned windows after MCP crash

Mitigation:

- Desktop TTL cleanup is mandatory.
- MCP release is best-effort, not the only cleanup path.

### Risk: wrong pet targeted

Mitigation:

- Desktop owns requested→actual resolution.
- `openpets_status` reports requested/configured and actual target.
- Missing/broken explicit pets fall back to default with reason.
- `targetKind` separates persistent default-controller routing from explicit temporary pet-window routing.

### Risk: privacy/spam through lease-scoped speech

Mitigation:

- Reuse existing `pet.say` validation and speech settings.
- Keep transient message replacement behavior; no unbounded queue.

## Security/privacy notes

- Local-only IPC remains token/version protected.
- Lease ids are random, app-generated, and in-memory only.
- Fallback reasons are sanitized machine-readable codes only.
- No remote API.
- No shell execution.
- No pet installation/removal/default mutation exposed to agents.
- Speech safety rules still apply.
- No durable agent session state is persisted.

## Test/check plan

Automated checks:

```bash
pnpm check
pnpm --filter @open-pets/desktop check
pnpm --filter @open-pets/client check
pnpm --filter @open-pets/mcp check
```

Phase 06B should add checks for:

- Lease acquire default target.
- Lease acquire explicit installed target.
- Invalid CLI `--pet` string is passed to desktop fallback path when bounded.
- Missing/broken requested pet fallback.
- Heartbeat extends expiry.
- Heartbeat unknown lease returns structured stale/degraded behavior.
- Release removes lease.
- Release is idempotent for unknown/already-released lease.
- TTL cleanup expires stale lease.
- Status for expired lease reports stale/degraded behavior.
- Status/errors do not leak local paths/tokens/raw filesystem messages.
- Last lease release/expiry closes explicit temporary pet controller state.
- Multiple leases for same explicit pet keep that window until the final lease ends.
- Default pet lease release/expiry does not close persistent default pet.
- Unknown/expired lease id rejects lease-scoped say/react.
- MCP status maps configured/requested/actual/fallback/routing fields correctly.
- MCP say/react checks prove handlers wait for lease init and pass `leaseId` to the client.

## Manual verification guide

1. Start desktop:

   ```bash
   pnpm --filter @open-pets/desktop dev
   ```

2. Ensure at least one extra pet is installed from Pet Manager, for example `snoopy`.

3. Run MCP without `--pet` in an MCP inspector/client:

   ```bash
   node packages/mcp/dist/index.js
   ```

4. Call `openpets_status`; confirm it reports the current default pet as actual target and `routingImplemented: true`.

5. Call `openpets_react` / `openpets_say`; confirm the default pet reacts/says.

6. Run MCP with explicit installed pet:

   ```bash
   node packages/mcp/dist/index.js --pet snoopy
   ```

7. Confirm Snoopy opens as a separate temporary pet window and status reports actual target `snoopy`.

8. Call `openpets_react` / `openpets_say`; confirm Snoopy reacts/says, not the default pet.

9. Stop the MCP process; confirm Snoopy closes after release/cleanup while the default pet remains.

10. Start two MCP processes for the same explicit pet; confirm closing one keeps the temp pet open and closing both closes it.

11. Hard-kill/abruptly close one MCP process for an explicit pet; wait for TTL cleanup and confirm the temp pet closes.

12. Run MCP with missing pet:

    ```bash
    node packages/mcp/dist/index.js --pet does-not-exist
    ```

13. Confirm status reports fallback to default pet and tools affect the default pet.

14. Run MCP with malformed-but-bounded pet input and confirm desktop fallback is reported rather than exposing local errors.

Manual acceptance question:

```text
Does Phase 06B pass on your machine: MCP startup acquires leases, --pet opens an installed non-default temporary pet, tools target the leased pet, missing pets fall back clearly, and release/TTL cleanup closes only temporary explicit pets?
```

## Oracle plan review

Oracle reviewed the initial Phase 06B plan and approved the overall architecture, but blocked implementation until `--pet` fallback behavior and default-versus-explicit lease targeting were sharpened.

## Oracle feedback disposition

- Fixed: `@open-pets/mcp` should accept bounded raw `--pet` strings and let desktop validate/fallback, so invalid/uninstalled requested pets can follow product fallback behavior.
- Fixed: Added `targetKind: "default" | "explicit"` to distinguish persistent default-controller leases from explicit temporary pet-window leases.
- Fixed: Defined IPC/result contracts for acquire, heartbeat, release, and lease-scoped status.
- Fixed: Defined unknown heartbeat, idempotent release, and expired lease status behavior.
- Fixed: Required lease-initialization promise so tools cannot race ahead of startup acquisition.
- Fixed: Required heartbeat timer `unref()`, caught heartbeat failures, stale/degraded marking, and no reliance on async `exit` handlers.
- Fixed: Required sanitized machine-readable fallback reason codes only.
- Fixed: Required explicit-pet rendering helper that reads only local installed `spritesheet.webp` for a given pet id.
- Fixed: Expanded automated and manual tests for invalid `--pet`, release idempotency, unknown heartbeat, expired status, leakage prevention, multi-lease refcount, crash TTL cleanup, and default-pet persistence.
- Fixed: Defined exact raw `--pet` bounds and control/path/whitespace rejection before desktop fallback.
- Fixed: Defined stale `status({ leaseId })` response shape.
- Fixed: Required built-in/default requested ids to be special-cased before installed-pet path validation.
- Fixed: Clarified default-target leases report the live current default controller target if default changes after acquisition.
- Fixed: Required MCP say/react checks proving lease-init waiting and lease id forwarding.
- Fixed: Required temporary pet windows to use non-focus-stealing `showInactive` behavior.
- Fixed: Required heartbeat timer to stop after unknown/stale lease.

Implementation review disposition:

- Fixed: `LeaseManager.heartbeat()` and `get()` now reject/remove expired leases before cleanup can revive or use them.
- Fixed: MCP status now preserves stale/unknown lease state instead of reporting cached active leases.
- Fixed: MCP degraded reasons used in tool errors are sanitized before returning to agents.
- Fixed: Explicit leases preserve `targetKind: "explicit"` for their lifetime instead of downcasting if the pet later becomes default.
- Fixed: Explicit pet say/react respect paused and speech-disabled behavior through IPC before updating temporary windows.
- Fixed: Explicit pet rendering errors are caught/logged to avoid unhandled rejections.
- Fixed: `default_broken_fallback_builtin` fallback reason is emitted when the configured default is unusable.
- Fixed: Raw `--pet` bounds reject all control characters.
- Deferred: Additional transport-close release handling beyond signals remains useful, but current release plus desktop TTL cleanup is sufficient for Phase 06B manual verification.
- Fixed: MCP status prefers live desktop lease status fields over cached acquire-time lease data when available.
- Fixed: Unavailable/degraded MCP status still reports `routingImplemented: true` for Phase 06B.
- Fixed: MCP help text now describes real `--pet` routing and fallback instead of stale Phase 06A behavior.
- Fixed: Added best-effort release on stdio transport close in addition to signal handling.
