# Phase 08: Claude Enhanced Hooks

## Goal

Make Claude Code feel polished by adding safe global Claude hooks that send automatic OpenPets reactions and short local speech through `@open-pets/claude` and `@open-pets/client`.

This phase builds on Phase 07's Claude Code detection/MCP configuration UI. Phase 08 should let the user install, doctor, and uninstall OpenPets-managed Claude hooks with explicit confirmation and backups.

## Non-goals

- No direct changes to Claude MCP configuration beyond what Phase 07 already provides.
- No Cursor, VS Code, Windsurf, OpenCode, or Antigravity hooks.
- No model-generated speech.
- No displaying user prompt text, code, logs, file paths, command text, transcript contents, or tool input in pet speech.
- No blocking/denying Claude actions. OpenPets hooks are decorative/status-only and should fail open.
- No shell scripts, Unix-only sockets, `nc`, `/tmp` socket paths, or Bun runtime dependency.
- No durable persistence of Claude session payloads or transcripts.

## User-visible/manual outcome

From **Configure Agents...**, the Claude Code card gains enhanced hook controls:

- Hook status: not installed / installed / needs update / error.
- Preview of the exact hook entries OpenPets will add to Claude user settings.
- Install hooks with explicit confirmation and backup.
- Doctor/check hooks.
- Uninstall OpenPets-managed hooks only.

In a real Claude Code session, the pet reacts automatically:

- User prompt submitted → thinking, occasional short thinking speech.
- Tool use → editing/running/testing reaction, usually silent.
- Permission request → waiting reaction + clear approval message.
- Notification → waiting/attention reaction, silent by default.
- Stop → success reaction + occasional short success speech.
- Stop failure → error reaction + occasional short error speech.

## Acceptance criteria

- `@open-pets/claude` exposes a Node/npm/npx-friendly hook entry point, for example:
  - `open-pets-claude hook`
  - final published/dev preview command may be displayed as `npx -y @open-pets/claude hook` until packaging decides global/local binary details.
- Hook command reads Claude hook JSON from stdin with a strict byte limit and timeout-friendly behavior.
- Hook command never blocks Claude intentionally:
  - returns exit code 0 for handled, ignored, and degraded OpenPets-unavailable cases.
  - only uses non-zero exit for unrecoverable CLI/runtime invocation errors before hook handling begins.
- Hook command stdout is always empty, including `UserPromptSubmit`, because Claude may ingest stdout as context.
- Installed hook entries must not synchronously block Claude for decorative status updates:
  - use Claude hook `"async": true` where supported.
  - keep timeout short, initially 3 seconds.
  - if async hooks are not supported by the installed Claude version, doctor/install must warn and fail closed rather than installing cold-start `npx` hooks on high-frequency events.
  - future packaging may replace `npx` with a faster local/bundled binary, but Phase 08 should not rely on synchronous `npx` for `PreToolUse`.
- Hook command sends OpenPets events through `@open-pets/client` only; no direct socket/manual JSON writes.
- Hook mapping handles the selected Claude hook events and ignores all others safely:
  - `UserPromptSubmit` → `thinking` + selective speech.
  - `PreToolUse` → `editing`, `testing`, `running`, or `working` based on `tool_name` and safe classification of `tool_input`.
  - `PermissionRequest` → `waiting` + fixed approval speech.
  - `Notification` → `waiting` by default, no speech.
  - `Stop` → `success` + selective speech.
  - `StopFailure` → `error` + selective speech.
- If Claude event names differ on an installed Claude version, unknown events are ignored safely and surfaced in doctor output where possible.
- Speech uses local static message pools/templates only.
- Speech safety rules are enforced:
  - max 140 characters.
  - single-line only.
  - no code blocks/code-like snippets.
  - no URLs.
  - no absolute/relative path-like content.
  - no secret-looking values.
  - never include raw user prompt/tool input/assistant response/transcript content.
- Speech is throttled/selective:
  - no speech on `PreToolUse` or `Notification` by default.
  - permission speech always allowed subject to a short cooldown to avoid duplicates.
  - lifecycle speech has a cooldown, initially at least 20 seconds per category.
  - throttle state is ephemeral and stored outside Claude settings, with bounded size and no payload content.
- Hooks route through the default OpenPets desktop route in Phase 08:
  - Because Claude hooks do not reliably know the active MCP lease id, they call `react`/`say` without `leaseId` and therefore affect the desktop default pet.
  - Future lease-aware Claude routing is explicitly deferred until a reliable session↔lease correlation is available.
- Global hook installation targets Claude Code user settings:
  - default path `~/.claude/settings.json` only for Phase 08.
  - do not honor `CLAUDE_CONFIG_DIR` unless a later phase verifies it is official/current Claude Code behavior.
  - creates a timestamped backup before writing.
  - validates settings is a JSON object before modifying.
  - settings path must be missing or a regular file; abort on symlink/special file surprises.
  - create parent directory with restrictive permissions where practical.
  - write temp file with restrictive permissions where practical before atomic rename.
  - preserves unrelated settings and unrelated hooks.
  - installs only clearly OpenPets-managed command hooks.
  - uninstall/update matching requires the `--openpets-managed` marker; package-name-only matching is not enough.
  - idempotent reinstall/update.
  - atomic write where practical.
- Uninstall removes only OpenPets-managed hook commands and leaves unrelated user/project hooks intact.
- Agent Setup UI shows hook status, preview, install/update, doctor, and uninstall controls with explicit warning that hooks execute commands from Claude Code, are global user-scope across Claude projects, and route to the OpenPets default pet in Phase 08.
- Agent Setup provides a local dev command toggle so manual testing can install Claude MCP/hooks against this checkout's built `dist` files instead of published `npx` packages:
  - production MCP: `npx -y @open-pets/mcp ...`
  - local MCP: `node <repo>/packages/mcp/dist/index.js ...`
  - production hooks: `npx -y @open-pets/claude hook --openpets-managed`
  - local hooks: `node <repo>/packages/claude/dist/cli.js hook --openpets-managed`
- Automated checks cover hook payload parsing, event mapping, speech safety, throttling decisions, settings merge/uninstall behavior, and command preview.
- `pnpm check` passes.

## Proposed files/directories

- `packages/claude/package.json`
  - Add `bin` for `open-pets-claude`.
  - Ensure check builds and validates hooks.
- `packages/claude/src/cli.ts`
  - CLI dispatcher for `hook`, `doctor-hooks`, maybe install/uninstall helpers used by desktop/tests.
- `packages/claude/src/hooks.ts`
  - Hook payload parsing, event mapping, client calls, speech selection/throttling.
- `packages/claude/src/hook-messages.ts`
  - Static local speech pools.
- `packages/claude/src/hook-settings.ts`
  - Claude settings path resolution, backup, merge, preview, uninstall, doctor helpers.
- `packages/claude/src/check-claude-hooks.ts`
  - Contract checks.
- `packages/claude/src/index.ts`
  - Export hook helpers for desktop.
- `apps/desktop/src/agent-setup.ts`
  - Add hook status/preview/install/doctor/uninstall orchestration and action journal entries.
- `apps/desktop/src/windows.ts`
  - Add hook section to Claude Code card.
- `apps/desktop/preload.cjs`
  - Add narrow hook actions through `openpetsAgentSetup`.
- `docs/phases/phase-08-claude-enhanced-hooks.md`

## Technical approach

### Hook command behavior

Claude Code command hooks receive JSON on stdin. The OpenPets hook command should:

1. Read stdin up to a strict limit, initially 64 KiB.
2. Parse JSON defensively.
3. Determine `hook_event_name` and safe metadata such as `tool_name`.
4. Map to an OpenPets reaction and optional static speech.
5. Send via `createOpenPetsClient({ connectTimeoutMs: 500, responseTimeoutMs: 500 })`.
6. Swallow OpenPets-unavailable errors and exit 0.

The command should write debug output only to stderr when `OPENPETS_DEBUG=1`; stdout must stay empty so Claude does not receive unintended context.

### Event mapping

Initial mapping:

```text
UserPromptSubmit  → react thinking; maybe say thinking pool
PreToolUse Edit   → react editing
PreToolUse Write  → react editing
PreToolUse MultiEdit → react editing
PreToolUse Bash with test-ish command → react testing
PreToolUse Bash otherwise → react running
PreToolUse other tool → react working
PermissionRequest → say "Approval needed" with waiting reaction
Notification      → react waiting; no speech
Stop              → say success pool with success reaction
StopFailure       → say error pool with error reaction
unknown           → no-op
```

Tool input is used only for classification, never copied into speech.

### Speech pools

Use local, short, safe strings. Example categories:

```text
thinking: "Thinking it through", "Let me check", "On it"
success: "Done", "That worked", "All set"
error: "Something failed", "Needs another look", "Hit a snag"
permission: "Approval needed"
```

Selection should be deterministic enough for tests but varied at runtime, for example injectable random source in tests.

### Throttling

Throttle state should not include hook payload content. Store only timestamps/counters by category in an OpenPets-owned file, for example:

Use a pure Node cross-platform path because the hook runs outside Electron:

```text
macOS/Linux: ${XDG_STATE_HOME:-~/.local/state}/openpets/claude-hook-throttle.json
Windows: %LOCALAPPDATA%\OpenPets\claude-hook-throttle.json
fallback: os.tmpdir()/openpets-<uid>/claude-hook-throttle.json
```

Requirements:

- Bounded JSON object.
- Atomic best-effort write.
- Safe if missing/corrupt.
- No hard failure if throttle storage cannot be read/written.

### Settings install/update/uninstall

Use Claude Code user settings:

```text
~/.claude/settings.json
```

Hook config shape should follow current Claude docs:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx -y @open-pets/claude hook --openpets-managed",
            "timeout": 3,
            "async": true,
            "asyncRewake": false
          }
        ]
      }
    ]
  }
}
```

Use one OpenPets-managed command per event with the stable `--openpets-managed` marker in the command so uninstall can safely identify owned hooks.

Install algorithm:

1. Resolve settings path to `~/.claude/settings.json`.
2. Read existing file if present; missing file becomes `{}`.
3. Refuse symlink/special-file settings paths; allow missing or regular file only.
4. Validate top-level JSON object.
5. Validate `hooks` is absent or object; if malformed, abort and ask user to fix manually.
6. Verify Claude hook async support from current docs/known behavior and local checks where practical. If no reliable local check exists, install may proceed based on documented support but doctor must warn when support is uncertain.
7. Create backup before write: `settings.json.openpets-backup-YYYYMMDD-HHMMSS.json`.
8. Remove previous OpenPets-managed hook commands.
9. Add current OpenPets-managed async hook entries.
10. Atomic write temp file + rename.

Uninstall algorithm:

1. Resolve/read/validate settings.
2. Backup before write.
3. Remove only hook commands containing the `--openpets-managed` marker.
4. Prune empty arrays/objects created by OpenPets where safe.
5. Atomic write.

Doctor should report:

- settings path.
- whether file exists and parses.
- whether hooks object is valid.
- installed/up-to-date/needs update/not installed.
- backup path from last install/uninstall if applicable.
- whether OpenPets desktop IPC is reachable.
- reminder that Claude hooks require trusted workspaces and Claude restart/reload if settings were changed.

### Agent Setup UI

Add an **Enhanced Claude hooks** section to the existing Claude Code card:

- Status badge.
- Preview JSON snippet.
- Buttons: Doctor hooks, Install/Update hooks, Uninstall hooks.
- Warning copy: Claude hooks execute command hooks automatically; OpenPets-managed hooks are status-only, fail open, and do not inspect/store code content.
- Local dev command toggle shared with the MCP setup preview/actions.

## Risks and tradeoffs

- Claude hook schemas/events can change. Mitigation: parse defensively, ignore unknowns, document event contract, keep doctor actionable.
- Hooks are command execution. Mitigation: explicit confirmation, preview, OpenPets marker, uninstall, backups, no silent edits.
- Direct settings edits can corrupt user config if careless. Mitigation: validate JSON object, backup, atomic writes, preserve unrelated keys, abort on malformed hooks.
- `npx -y @open-pets/claude hook` may be slow for frequent hooks. Mitigation: no speech on high-frequency tool events; hook timeout 3 seconds; future packaging can switch command to bundled/local binary.
- Hooks may be skipped in untrusted Claude workspaces. Mitigation: doctor/manual guide documents trust requirement.
- Session-to-MCP-lease routing is ambiguous. Mitigation: Phase 08 explicitly routes hook events to default pet; MCP per-project pet routing remains available through tools/leases.

## Security/privacy notes

- Never include raw Claude payload content in speech.
- Do not read transcript files.
- Do not store hook payloads, prompts, tool inputs, assistant messages, cwd, transcript paths, or session ids in durable logs.
- Debug logs, if enabled, must be minimal and sanitized.
- Hook stdout must stay empty; use stderr for debug only when `OPENPETS_DEBUG=1`.
- Hook commands must fail open and avoid blocking user work.
- Settings installer must preserve unrelated hooks and avoid removing anything not OpenPets-managed.
- Hook settings must be async/background; do not install synchronous cold-start `npx` hooks for high-frequency events.
- Speech safety filters should reuse or match MCP speech safety rules.

## Test/check plan

- `packages/claude` checks:
  - hook event mapping fixtures for each accepted event.
  - malformed/oversized stdin handling.
  - speech safety rejects code/path/url/secret/multiline/overlength content.
  - throttling allows/blocks expected categories without storing payload content.
  - settings install preview/merge preserves unrelated settings and hooks.
  - settings reinstall is idempotent.
  - settings uninstall removes only OpenPets-managed hooks.
  - malformed settings/hook object aborts safely.
  - symlink/special-file settings path aborts safely.
  - generated hook config includes `--openpets-managed`, `timeout: 3`, and `async: true`.
  - published/local command previews for MCP and hooks.
- Desktop checks:
  - Agent Setup hook action validation/sender restrictions where practical.
- Workspace:
  - `pnpm check`

## Manual verification guide

After implementation:

1. Run `pnpm check`.
2. Start desktop: `pnpm --filter @open-pets/desktop dev`.
3. Open tray → **Configure Agents...**.
4. In Claude Code, confirm MCP is configured from Phase 07 or configure it now.
5. Inspect Enhanced Claude hooks preview.
   For local checkout testing, enable **Use local dev commands** and confirm previews use `node .../packages/mcp/dist/index.js` and `node .../packages/claude/dist/cli.js` instead of `npx`.
   Local dev mode writes absolute checkout paths into Claude config; uninstall or replace it before moving/deleting the checkout.
6. Click Doctor hooks and confirm it reports settings status clearly.
7. Click Install/Update hooks only if okay modifying `~/.claude/settings.json`.
8. Confirm a backup file was created next to Claude settings.
9. Confirm malformed settings are reported safely by temporarily testing against a fake settings path in checks or a controlled test profile, not by corrupting your real settings.
10. Confirm unrelated hook entries remain after install/update.
11. Confirm reinstall is idempotent.
12. Start/restart Claude Code in a trusted workspace.
13. Invoke a hook command with a stdin fixture directly, for example a `UserPromptSubmit` fixture, and confirm it exits 0 with empty stdout even if OpenPets desktop is unavailable.
    Example after build: `printf '{"hook_event_name":"UserPromptSubmit","prompt":"hello"}' | node packages/claude/dist/cli.js hook --openpets-managed`.
14. Submit a real prompt and confirm the pet reacts thinking with occasional safe speech.
15. Run/edit/test from Claude and confirm reactions change without noisy speech.
16. Trigger a permission request and confirm waiting + approval message.
17. Finish a response and confirm success speech/reaction.
18. If possible, trigger a failing turn and confirm error reaction/speech.
19. Quit OpenPets desktop and confirm Claude hooks do not break Claude Code.
20. Return to Agent Setup and click Uninstall hooks.
21. Confirm OpenPets-managed hook entries are removed, uninstall is idempotent, and unrelated Claude settings remain.

Expected results:

- Hooks are explicit, reversible, and backed up.
- Backups may contain user-sensitive Claude settings; keep them local/private.
- Pet reactions feel automatic and non-spammy.
- Speech is short, local, safe, and never includes private prompt/tool content.
- Broken/missing OpenPets desktop app does not break Claude Code.

## Oracle plan review

Reviewed. Oracle found the phase boundary sound but flagged one blocker:

- Decorative hooks cannot rely on synchronous cold-start `npx`, especially for frequent `PreToolUse`; hook entries must be async/background or use a fast local binary.

Oracle also requested: marker in examples, no `CLAUDE_CONFIG_DIR` until verified, UI warnings about global/default-pet routing, pure Node throttle path, regular-file/no-symlink settings hardening, selected-events wording, and expanded manual verification.

## Oracle feedback disposition

Fixed:

- Required `async: true` hook entries with short timeout and fail-closed install if async support is unavailable/uncertain.
- Added `--openpets-managed` marker to preview/config examples.
- Removed `CLAUDE_CONFIG_DIR` support from Phase 08 scope.
- Added UI warning requirement for global user-scope hooks and Phase 08 default-pet routing.
- Defined pure Node cross-platform throttle-state path.
- Added settings path hardening: missing/regular file only, abort symlink/special files, restrictive permissions where practical.
- Clarified Phase 08 handles selected Claude events and ignores others safely.
- Expanded tests/manual verification for malformed settings, unrelated hooks preservation, idempotency, unavailable desktop, stdin fixture invocation, and uninstall idempotency.

Fixed after re-review:

- Required empty hook stdout for all events.
- Clarified async support verification may rely on documented support with doctor warning if no reliable local check exists.
- Tightened uninstall/update matching to require `--openpets-managed` marker.
- Added `asyncRewake: false` to generated config, stdin fixture command example, and backup privacy note.
