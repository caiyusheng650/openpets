# Phase 10B: Packaged Claude Command Distribution

## Goal

Make the packaged OpenPets desktop app capable of configuring Claude Code without relying on unpublished `npx @open-pets/*` packages.

Phase 10B should add a packaged/bundled command mode that points Claude MCP and Claude hooks at JavaScript entry points shipped inside the packaged app resources.

## Non-goals

- No npm publishing.
- No public signed/notarized release.
- No auto-update.
- No changing the public MCP tool set.
- No new agent integrations beyond Claude.
- No model-generated speech.
- No removing the existing published `npx` command mode for future published packages.
- No weakening Claude configuration confirmation/backups.

## User-visible/manual outcome

In the packaged app, Agent Setup no longer asks users to configure private/unpublished `npx` packages by default.

Instead, packaged Agent Setup previews and installs commands like:

```text
node <packaged-app-resource>/app/node_modules/@open-pets/mcp/dist/index.js
node <packaged-app-resource>/app/node_modules/@open-pets/claude/dist/cli.js hook --openpets-managed
```

The exact path is platform-specific, but it must be inside the packaged app output/resources and must be a regular file.

In dev/unpackaged mode, the existing behavior remains:

- published mode: `npx -y @open-pets/...`
- local dev mode: built checkout `dist` paths

## Acceptance criteria

- `@open-pets/desktop` packages the runtime packages required for bundled Claude commands:
  - `@open-pets/mcp`,
  - `@open-pets/claude`,
  - `@open-pets/client`,
  - required third-party runtime dependencies.
- Agent Setup chooses command mode by environment:
  - packaged app: bundled packaged mode,
  - dev app: published/local dev toggle remains available.
- The Agent Setup renderer/preload accepts and renders bundled command mode snapshots without treating them as invalid.
- Packaged Agent Setup checks Node availability for Claude-launched commands, or clearly disables configure/install with a warning if Node is unavailable/too old.
- Packaged mode command previews use `node <packaged resource path>` and never `npx -y @open-pets/...` unless the user is explicitly in published mode in dev.
- Packaged MCP command points at a regular file shipped inside package resources.
- Packaged hook command points at a regular file shipped inside package resources.
- Packaged command paths are not source-checkout paths and do not use `app.getAppPath()` assumptions that fail after packaging.
- Packaged commands are validated before install/doctor/configure actions:
  - path exists,
  - path is a regular file,
  - real path is inside packaged app resources/app directory,
  - symlink escapes are rejected,
  - `.asar` paths are rejected unless the file is explicitly unpacked/readable as a regular file,
  - command contains no newline/null/unsupported shell characters.
- Missing bundled resources produce an actionable Agent Setup status/error, not an unhandled IPC failure.
- Claude MCP configure/replace/remove still uses `claude mcp ...` and still requires explicit user button actions.
- Claude hook install/update/uninstall still writes only OpenPets-managed hooks and still creates backups.
- Doctor/preview text clearly labels packaged bundled mode and explains commands point into the installed OpenPets app.
- If packaged bundled command resources are missing, Agent Setup shows an actionable error and disables configure/install actions rather than falling back silently to unpublished `npx` packages.
- Existing contract checks cover packaged bundled command files in package output.
- Existing Claude code/hooks contract checks cover bundled command preview/matching behavior.
- `pnpm test` passes.
- `pnpm check` passes.
- `pnpm package:desktop:dir` passes.

## Proposed files/directories

- `packages/claude/src/claude-code.ts`
  - Add command mode support for packaged bundled MCP command paths.
- `packages/claude/src/hook-settings.ts`
  - Add command mode support for packaged bundled hook CLI command paths.
- `packages/claude/src/check-claude-code.ts`
  - Add bundled command preview/status checks.
- `packages/claude/src/check-claude-hooks.ts`
  - Add bundled hook settings checks.
- `apps/desktop/src/agent-setup.ts`
  - Select bundled mode in `app.isPackaged`.
  - Validate packaged resource paths and surface errors.
  - Check/warn for Node availability for packaged bundled commands.
  - Keep dev local toggle unavailable in packaged app.
- `apps/desktop/preload.cjs`
  - Accept/render `commandMode: "bundled"` snapshots and label bundled mode clearly.
- `apps/desktop/package.json`
  - Add `@open-pets/mcp` as a desktop runtime dependency so packaged output includes it.
- `apps/desktop/src/check-packaging-contract.ts`
  - Require packaged MCP/Claude/client entry files and MCP runtime deps.
- `docs/mvp-validation.md`
  - Update Phase 10B status and manual Claude packaged validation steps.
- `docs/phases/phase-10b-packaged-claude-command-distribution.md`

## Technical approach

### Command mode model

Extend `OpenPetsCommandMode` from:

```ts
"published" | "local"
```

to:

```ts
"published" | "local" | "bundled"
```

Semantics:

- `published`: npm/npx package names.
- `local`: checkout-relative built `dist` files for development.
- `bundled`: package-relative files shipped in the packaged app's `node_modules/@open-pets/*/dist` directories.

For current unpacked Phase 10A packaging (`asar: false`), `bundled` paths can be resolved from `@open-pets/claude`'s own `import.meta.url` in packaged node_modules:

```text
.../Resources/app/node_modules/@open-pets/claude/dist
.../Resources/app/node_modules/@open-pets/mcp/dist/index.js
```

This mirrors the current `local` sibling-package resolution, but should be named `bundled` so the UI does not imply a fragile source checkout path.

### Desktop mode selection

In desktop Agent Setup:

- `app.isPackaged` should force `bundled`.
- Dev mode keeps current published/local toggle.
- UI should show the dev checkbox disabled in packaged app, with text indicating packaged bundled commands are used.

### Hook settings

Bundled hook settings should still use the OpenPets marker:

```text
node "<path>/@open-pets/claude/dist/cli.js" hook --openpets-managed
```

Uninstall must continue to remove any OpenPets-managed hooks by marker, including old published/local commands.

Install/update should replace old OpenPets-managed published/local commands with bundled commands when running from packaged app.

### MCP settings

Bundled MCP settings should configure Claude with:

```json
{
  "type": "stdio",
  "command": "node",
  "args": ["<path>/@open-pets/mcp/dist/index.js"]
}
```

If a pet is selected:

```json
"args": ["<path>/@open-pets/mcp/dist/index.js", "--pet", "pet-id"]
```

### Packaging contract

Package output checks should assert:

- `node_modules/@open-pets/mcp/dist/index.js` exists.
- `node_modules/@open-pets/claude/dist/cli.js` exists.
- `node_modules/@open-pets/client/dist/index.js` exists.
- required MCP third-party dependencies exist (`@modelcontextprotocol/sdk`, `zod`, etc.) if included by builder.
- no symlink escapes package output.

### Security/safety

Path validation should reject:

- missing files,
- directories/symlinks when a regular file is expected,
- paths whose `realpath` is outside the packaged app resource/app root in bundled mode,
- `.asar` paths unless the target is explicitly unpacked/readable as a regular file,
- command strings containing newline/null.

Do not silently fall back to `npx` in packaged app if bundled resources are missing; that would reintroduce the Phase 10A blocker.

## Risks and tradeoffs

- **Installed app path moves.** Claude settings will contain absolute paths into the installed app; if the user moves/deletes OpenPets, Agent Setup doctor should report needs update/error and the user should reinstall/update config.
- **ASAR disabled in Phase 10A.** Bundled commands rely on regular files. If ASAR is enabled later, MCP/Claude command files must move to `asarUnpack` or `extraResources`.
- **Node availability.** Commands use `node`, so users still need Node available for Claude to launch MCP/hooks. This matches the project's Node/npm/npx direction and avoids bundling a separate runtime in this phase.
- **Cross-platform paths.** Windows paths with spaces must be handled through Claude MCP arg arrays and shell-quoted hook command strings.

## Security/privacy notes

- No silent Claude configuration changes.
- Backups remain required before Claude settings hook writes.
- Bundled commands are local files shipped with OpenPets, not remote downloads.
- No TCP/HTTP control plane is introduced.
- Speech/privacy rules from earlier phases remain unchanged.
- Uninstall removes only OpenPets-managed hooks by marker.

## Test/check plan

Run:

```bash
pnpm test
pnpm check
pnpm package:desktop:dir
```

Automated coverage:

- bundled MCP preview command shape,
- bundled hook command shape,
- parse/classify expected bundled Claude MCP entries,
- bundled paths with spaces/backslashes in MCP arg arrays and hook shell quoting,
- bundled command path validation for existing and missing files,
- renderer/preload snapshot validation accepts `commandMode: "bundled"`,
- package output includes MCP/Claude/client runtime entries and MCP runtime deps.

## Manual verification guide

1. Run:

```bash
pnpm test
pnpm check
pnpm package:desktop:dir
```

2. Launch the packaged app.
3. Open Agent Setup.
4. Confirm command preview uses `node <packaged .../node_modules/@open-pets/mcp/dist/index.js>`, not `npx -y @open-pets/mcp`.
5. Confirm hook preview uses `node <packaged .../node_modules/@open-pets/claude/dist/cli.js> hook --openpets-managed`.
6. Configure Claude MCP only if you are ready to update your user Claude settings; verify backup/config behavior as in earlier phases.
7. Install/update hooks only if you are ready to update your user Claude settings; verify backup/config behavior as in earlier phases.
8. Run Claude Code and confirm MCP/hook behavior if desired.
9. Use Agent Setup to remove MCP/hooks after testing if you do not want packaged paths left in Claude settings.

## Oracle plan review

Reviewed by Oracle.

Blocker:

- The original plan omitted renderer/preload bundled-mode support. Current `apps/desktop/preload.cjs` validates command mode as only `published` or `local`, so a bundled snapshot would be rejected. The spec must include preload/renderer handling.

Should-fix feedback:

- Add explicit Node prerequisite handling because packaged bundled commands require `node` on Claude's PATH.
- Validate bundled paths with `realpath` against the packaged app root, not simple string prefix. Reject missing files, directories, symlinks, `.asar` paths unless unpacked, newline/NUL/quote/shell-dangerous chars.
- Ensure missing bundled resources produce actionable Agent Setup status/error instead of unhandled IPC failure.
- Add cross-platform tests for paths with spaces/backslashes, MCP args arrays, hook shell quoting, and bundled `claude mcp get` parsing.
- Extend package contract checks to require `@open-pets/mcp/dist/index.js` plus runtime deps like `@modelcontextprotocol/sdk` and `zod`.
- Update docs to state Claude settings contain absolute OpenPets app paths; moving/deleting/updating the app may require Agent Setup replace/update/remove.

Nice-to-have feedback:

- Centralize command-mode/path resolution helpers.
- Show shortened paths in UI while writing full absolute paths to Claude settings.
- Add future ASAR note for `asarUnpack` or `extraResources`.

Verdict: architecture is sound, but not implementation-ready until preload bundled-mode support and path/quoting/test clarifications are added.

## Oracle feedback disposition

Fixed:

- Added `apps/desktop/preload.cjs` to proposed files and acceptance criteria for bundled-mode renderer support.
- Added Node prerequisite warning/disable requirement.
- Strengthened realpath/path validation requirements.
- Added missing-resource error-state requirement.
- Added cross-platform path/quoting tests to test plan.
- Added MCP runtime deps to package contract requirements.
- Added absolute packaged path docs requirement.

Accepted:

- Centralize command/path helpers where practical during implementation.
- Show shortened paths in UI while writing full paths if cheap.

Deferred:

- ASAR support remains future release hardening; Phase 10B should note that ASAR requires `asarUnpack`/`extraResources` for externally executed JS files.

## Oracle implementation review

Reviewed by Oracle after implementation.

Blockers: none.

Should-fix feedback:

- Prevent broken writes when `node` is unavailable. `detectClaudeCodeStatus()` reports “Node required”, but action handlers must also guard configure/replace/install-hooks in bundled mode.
- Keep cleanup available on bundled-resource errors. `remove` and `uninstall-hooks` should not be blocked by missing bundled MCP/hook resources.
- Add stronger Windows/path tests for hook command quoting, MCP args arrays, and text parsing of bundled paths with spaces.
- Reject symlink command files or document reliance on package checks.
- Manual packaged Agent Setup verification remains required.

Nice-to-have feedback:

- Make bundled tests explicitly depend on built `@open-pets/mcp` or avoid relying on stale sibling `dist` state.
- Clarify Node PATH check is best-effort because Claude's runtime environment may differ.
- Keep ASAR/`extraResources` deferred as documented.

Verdict: architecture is sound and package contract is substantially adequate; fix node/action guard and cleanup-path issues before final acceptance.

## Oracle implementation feedback disposition

Fixed:

- Added action-level bundled Node guard before configure/replace/install-hooks.
- Moved cleanup actions so `remove` and `uninstall-hooks` remain available even if bundled command resources are missing.
- Added quoted-path parsing and Windows-style path display checks for Claude MCP command handling.
- Runtime bundled command validation now rejects symlink entry files in addition to using `realpath` containment checks.

Accepted:

- Manual packaged Agent Setup verification remains a phase gate.

Deferred:

- ASAR/`extraResources` release hardening remains deferred.

Final Oracle re-check:

- Blockers: none.
- Remaining should-fix: none from the prior Oracle review.
- Manual packaged Agent Setup UI verification remains as the phase gate before closing.
- Verdict: proceed to user manual packaged verification for bundled MCP preview/configure, hook preview/install, real Claude behavior if desired, and cleanup/remove.
