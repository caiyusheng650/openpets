# Phase 05: Local IPC and client package

## Goal

Create the private local control plane between the Electron desktop app and Node-based adapters such as `@open-pets/mcp`, `@open-pets/claude`, and `@open-pets/cli`.

After this phase, a developer can run the desktop app and use `@open-pets/client` from Node to call local IPC methods that report app status and make the visible default pet react in a small, manually verifiable way.

## Non-goals

- MCP server package implementation.
- Claude hooks implementation.
- Auto-launching the desktop app from the client.
- Remote HTTP/TCP API.
- Agent lease lifecycle and heartbeat cleanup.
- Full speech bubble product UI.
- Rich animation-state engine.
- Production installer integration.
- Pet install/remove/default over public IPC.

## User-visible/manual outcome

With the desktop app running, a developer can run a local Node command from `packages/client` that connects through a discovery file to the desktop app and calls:

```text
status
pet.react
pet.say
```

The desktop app rejects invalid tokens/versions. `pet.react` and `pet.say` produce a visible temporary state in the existing default pet window, enough to prove the local control plane works before MCP is built.

## Acceptance criteria

- Desktop app starts a local-only IPC server on app ready.
- IPC transport is cross-platform:
  - macOS/Linux: Unix domain socket.
  - Windows: named pipe.
- Desktop app writes a discovery file while the IPC server is running.
- Discovery file includes protocol version, endpoint, random startup token, app version, platform, and pid.
- Discovery file does not contain durable secrets beyond the current startup token.
- Discovery file and runtime directory use restrictive permissions where supported.
- Unix socket paths are short enough for common `sockaddr_un` limits.
- Unix stale socket files are cleaned up before bind and on normal shutdown.
- Windows named pipe path uses the `\\.\pipe\...` namespace and does not depend on filesystem cleanup.
- Every request includes protocol version and startup token.
- Invalid token requests are rejected.
- Invalid protocol version requests are rejected.
- Malformed JSON and unknown methods return errors without crashing the app.
- IPC request size is bounded.
- The server handles socket/client errors without crashing.
- `@open-pets/client` can read discovery, connect, send one request, and return typed results.
- `@open-pets/client` has connection/request timeout behavior.
- Initial methods are implemented:
  - `hello`
  - `status`
  - `pet.react`
  - `pet.say`
- `status` reports whether the app is reachable, app version, protocol version, default pet id, default pet display name, and paused/open-default-pet state where available.
- `pet.react` accepts the initial public reaction names from `task.txt` and visibly updates the default pet label/state temporarily.
- `pet.say` accepts a short message, enforces the Phase speech/message safety rules at a minimal level, and visibly updates the default pet label/message temporarily.
- Public IPC does not expose pet installation, removal, default switching, filesystem, shell, Electron, or generic invoke access.
- Automated checks cover protocol validation and client request/response parsing where practical.

## Proposed files/directories

Expected additions/changes:

```text
docs/phases/phase-05-local-ipc-client.md
apps/desktop/src/local-ipc.ts
apps/desktop/src/local-ipc-protocol.ts
apps/desktop/src/default-pet-controller.ts
apps/desktop/src/pet-window.ts
apps/desktop/src/main.ts
packages/client/src/index.ts
packages/client/src/protocol.ts
packages/client/src/discovery.ts
packages/client/src/check-client-protocol.ts
packages/client/package.json
```

Exact file split may change during implementation if a simpler structure is clearer.

## Technical approach

### Transport

Use Node `node:net` in the Electron main process and in `@open-pets/client`.

Platform endpoint rules:

- macOS/Linux: create a Unix socket under a user-owned OpenPets runtime directory.
- Windows: create a named pipe path like `\\.\pipe\openpets-<user-or-session>-<pid>`.

No TCP listener is used in Phase 05.

### Runtime directory and discovery

Use a shared deterministic discovery location so the app and client can agree without Electron imports in the client package.

Discovery file location:

```text
macOS:   ~/Library/Application Support/OpenPets/runtime/ipc.json
Linux:   $XDG_RUNTIME_DIR/openpets/ipc.json when secure, otherwise ~/.config/OpenPets/runtime/ipc.json
Windows: %APPDATA%\OpenPets\runtime\ipc.json
```

Socket/pipe endpoint location:

```text
macOS:   /tmp/openpets-<uid>/openpets-<pid>.sock
Linux:   $XDG_RUNTIME_DIR/openpets/openpets-<pid>.sock when secure, otherwise /tmp/openpets-<uid>/openpets-<pid>.sock
Windows: \\.\pipe\openpets-<random>-<pid>
```

Do not put Unix socket files under the longer application-support discovery directory because common Unix socket path length limits are around 103-107 bytes.

Implementation can centralize path derivation constants in both desktop and client, as long as both sides agree and the path is documented.

Permission targets:

- Runtime directories: `0700` where supported.
- Discovery file: `0600` where supported.
- Unix socket: protected by the runtime directory and `chmod 0600` after bind where supported.
- Windows: rely on user AppData ACLs plus the startup token in Phase 05; do not claim a strong named-pipe ACL unless it is implemented.

Discovery shape:

```json
{
  "protocolVersion": 1,
  "protocol": "openpets-ipc",
  "endpoint": "/short/path/openpets.sock",
  "token": "random-startup-token",
  "appVersion": "0.0.0",
  "pid": 12345,
  "platform": "darwin"
}
```

Write discovery atomically through a temp file then rename where practical. Remove the discovery file on normal app shutdown if it still points at the current pid/token.

Treat discovery as untrusted in `@open-pets/client`: reject malformed JSON, wrong protocol, wrong protocol version, mismatched platform, unsupported endpoint shape, TCP-like host/port values, missing token, missing pid, and oversized discovery files.

Threat model: the startup token protects against accidental or cross-user access when file permissions hold. It is not a strong same-user security boundary. A same-user process that can read the discovery file can control the pet for that app run.

### Protocol

Use newline-delimited JSON over the local socket/pipe, one request and one response per connection in Phase 05. This keeps the client simple and avoids stream multiplexing before MCP needs it.

Protocol limits:

```text
max request bytes: 16 KiB
max response bytes in client: 16 KiB
connect timeout: 2 seconds
response timeout: 3 seconds
malformed/no-newline behavior: close with structured error when possible, otherwise close socket
```

Request:

```json
{
  "id": "uuid-or-random-id",
  "version": 1,
  "token": "startup-token",
  "method": "status",
  "params": {}
}
```

Response:

```json
{
  "id": "same-id",
  "ok": true,
  "result": {}
}
```

Error response:

```json
{
  "id": "same-id-if-known",
  "ok": false,
  "error": {
    "code": "invalid_token",
    "message": "Invalid IPC token."
  }
}
```

### Methods

`hello`:

- Confirms protocol compatibility and token validation.
- Returns app version and protocol version.

`status`:

- Returns current default pet summary and basic app state.

`pet.react`:

- Params: `{ "reaction": "testing" }`.
- Valid reactions: `idle`, `thinking`, `working`, `editing`, `running`, `testing`, `waiting`, `success`, `error`, `celebrating`.
- Updates the existing default pet renderer with a visible label/state for a short TTL.

`pet.say`:

- Params: `{ "message": "On it!", "reaction": "working" }`.
- Message must be short, single-line, not code-block-like, and not obviously secret-like.
- Updates the existing default pet renderer with a visible message for a short TTL.
- Respects `speechBubblesEnabled` and paused state where practical.
- Replaces the current transient message/reaction and resets its TTL instead of queuing unbounded messages.
- All dynamic message/reaction/display text must be HTML-escaped before renderer insertion.

### Client package

`@open-pets/client` should expose typed helpers:

```ts
createOpenPetsClient(options?): OpenPetsClient
client.hello()
client.status()
client.react(reaction)
client.say(message, options?)
```

The client reads discovery by default, connects to the endpoint, sends exactly one request, waits for one response, then closes.

Unavailable/stale discovery semantics:

- `client.status()` should return a typed unavailable/degraded result when discovery is missing, stale, malformed, or connection times out.
- Other method helpers may throw structured client errors for unavailable app state.

### Desktop integration

- Start IPC after app state and default-pet display handlers are initialized.
- Stop IPC during app shutdown.
- `pet.react` / `pet.say` should show the default pet if open-default-pet-on-launch is enabled or if the default pet window is already visible. It should not create extra pet windows beyond the default pet in Phase 05.
- Keep renderer content generated by the main process with a strict CSP. No remote content.

## Risks and tradeoffs

### Risk: local IPC security assumptions

Mitigation:

- Local-only socket/pipe; no TCP.
- Random startup token required on every request.
- Restrictive runtime directory, discovery file, and Unix socket permissions where available.
- Small method surface.
- Request size limit and fail-closed validation.

### Risk: cross-platform runtime path differences

Mitigation:

- Keep endpoint and discovery path logic small and documented.
- Prefer short Unix socket paths.
- Avoid clever platform-specific IPC beyond Node `net`.

### Risk: implementing too much MCP lifecycle too early

Mitigation:

- Phase 05 does not implement leases, heartbeats, MCP tools, auto-launch, or cleanup semantics for agent-owned temporary pets.
- It only proves the private app/client control plane.

## Security/privacy notes

- No remote API.
- No TCP listener.
- No shell command execution.
- No pet install/remove/default mutation over this initial public IPC.
- Startup token is random and per app run.
- Requests are bounded and parsed as untrusted input.
- `pet.say` must not display multiline/code/secret-looking content.
- Discovery file is a local convenience file, not durable account/auth state.

## Test/check plan

Automated checks:

```bash
pnpm check
pnpm typecheck
pnpm build
pnpm --filter @open-pets/desktop check
pnpm --filter @open-pets/client check
```

Phase 05 should add checks for:

- Discovery validation rejects malformed/wrong protocol/wrong platform/bad endpoint values.
- Endpoint generation covers Unix and Windows pipe shape without requiring Windows to run tests.
- Request validation rejects missing/invalid token.
- Request validation rejects unsupported protocol version.
- Unknown methods return structured errors.
- Malformed/oversized request handling is fail-closed.
- `pet.say` message validation rejects multiline, code-block-like, overlong, URL/path-heavy, or secret-looking input where practical.
- Client protocol parsing handles ok/error responses.

## Manual verification guide

1. Run the desktop app:

   ```bash
   pnpm --filter @open-pets/desktop dev
   ```

2. In another terminal, run the client smoke command added by this phase, for example:

   ```bash
   pnpm --filter @open-pets/client smoke:status
   pnpm --filter @open-pets/client smoke:react testing
   pnpm --filter @open-pets/client smoke:say "Working on it" working
   ```

3. Confirm status returns app/default-pet information.
4. Confirm invalid token smoke check fails with a structured rejection.
5. Confirm the visible default pet label/state changes for react/say.
6. Quit OpenPets and confirm the client reports that the app is unavailable.

Manual acceptance question:

```text
Does Phase 05 pass on your machine: local IPC discovery works, @open-pets/client can call status/react/say, invalid tokens are rejected, and quitting the app makes the client report unavailable?
```

## Oracle plan review

Oracle reviewed the Phase 05 plan and approved the architecture/scope with should-fix disposition required before implementation.

## Oracle feedback disposition

- Fixed: Made discovery path and socket/pipe endpoint paths concrete, keeping Unix socket paths short.
- Fixed: Required client-side discovery validation as untrusted input and forbade TCP-like discovery behavior.
- Fixed: Added concrete permission targets for runtime directories, discovery files, Unix sockets, and clarified Windows limitations.
- Fixed: Clarified same-user threat model: startup token is not a strong same-user security boundary.
- Fixed: Defined stale/unavailable discovery semantics for `client.status()`.
- Fixed: Added numeric protocol limits for request/response bytes and timeouts.
- Fixed: Required `pet.say` to respect speech/paused controls where practical, replace transient messages, and HTML-escape dynamic text.
- Fixed: Tightened automated check requirements for discovery validation, endpoint generation, invalid token/version/method, malformed/oversized input, say validation, and client response parsing.
- Fixed: Noted package Node typings/build requirement for `@open-pets/client`.
- Deferred: Environment override such as `OPENPETS_DISCOVERY_FILE` is useful for smoke tests and may be implemented if it stays simple.

Implementation review disposition:

- Fixed: Escaped built-in pet transient label/message text before injecting into generated pet HTML.
- Fixed: External `pet.react`/`pet.say` no longer force-show the default pet when the user has hidden it and disabled open-default-pet-on-launch; events only show an already-visible pet or the normal open-on-launch default pet.
- Fixed: Hardened fallback `/tmp/openpets-<uid>` runtime directory handling with ownership, symlink, and mode checks before trusting it.
- Fixed: Discovery file parsing now checks file size before read and wraps malformed JSON in structured client errors.
- Fixed: Discovery cleanup now removes the file only if it still points at the current pid/token/endpoint.
- Fixed: Client-side Unix endpoint validation now only accepts expected OpenPets runtime socket filename/directory patterns.
- Fixed: Paused behavior is quiet: `pet.say` and `pet.react` do not show/update visible transient state while paused.
- Fixed: Windows pipe suffix now uses cryptographic random bytes instead of `Math.random()`.
- Fixed: Reused the protocol transient display TTL constant instead of a hardcoded value.
- Fixed: Corrected macOS/Linux fallback socket endpoint generation to use literal `/tmp/openpets-<uid>` so it matches the documented path and client validation.
- Fixed: Malformed/oversized local IPC requests now return `invalid_request` structured errors instead of generic internal errors where possible.
- Deferred: Response id matching, stronger Windows pipe ACLs, and broader cross-platform endpoint-generation tests can be added with the MCP/packaging phases if needed.
