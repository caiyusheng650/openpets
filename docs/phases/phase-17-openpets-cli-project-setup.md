# Phase 17 — OpenPets CLI Project Setup

## Goal

Add a real npm-distributed OpenPets CLI that lets users configure the current project to use a selected pet with Claude, using one simple command.

Primary command:

```bash
npx @open-pets/cli configure --pet fixer
```

This should configure both Claude MCP and Claude hooks for the current project. No extra MCP/hooks questions.

## Non-goals

- App-installed `openpets` shim / Settings “Install CLI” button. Defer to a later phase.
- Shared/team project config by default.
- Supporting agents other than Claude.
- Remote/custom catalog flags.
- `openpets install <pet-id>`; defer pet installation CLI to a later phase.
- Exposing pet install/remove/default controls through MCP tools.
- Building a complex TUI. Keep interaction simple.

## User-visible/manual outcome

From a project directory, users can run:

```bash
npx @open-pets/cli configure --pet fixer
```

Expected result:

- Claude MCP is configured locally for the current project with OpenPets `--pet fixer`.
- Claude project-local hooks are configured with `--project-local --pet fixer`.
- Starting Claude from that project makes MCP tools and hook speech/reactions target fixer.

Users can also run:

```bash
npx @open-pets/cli configure --agent claude --pet fixer --cwd /path/to/project --yes
```

If `--pet` is omitted, the CLI lists installed pets and prompts for one.

## Acceptance criteria

- `packages/cli` exposes a real executable bin, `openpets`.
- `openpets configure --pet <id>` runs non-interactively for Claude using current working directory.
- `--agent claude` is accepted; unsupported agents fail clearly.
- `--cwd <path>` targets another project directory; default is `process.cwd()`.
- `--yes` is accepted as a compatibility/no-op flag; there is no final confirmation prompt in Phase 17.
- If `--pet` is missing, CLI queries installed pets from the running OpenPets desktop app and prompts the user to choose.
- CLI configures Claude MCP using local project scope, private to the current user.
- CLI configures Claude hooks in `<project>/.claude/settings.local.json`, private to the project/user.
- Claude MCP command is installed while spawning `claude` with `cwd` set to the resolved target project.
- Long-lived generated Claude MCP/hook commands use a stable package command, not a temporary `npx @open-pets/cli` install path.
- Hook commands include `--pet <id>`.
- Existing non-OpenPets hooks in `.claude/settings.local.json` are preserved.
- Existing OpenPets-managed hooks are replaced safely.
- CLI fails with clear instructions if OpenPets desktop app is not running.
- CLI fails clearly if Claude Code is unavailable on `PATH`.
- CLI validates selected pet ids and rejects unsafe values.

## Proposed files/directories

- `packages/cli/package.json`
- `packages/cli/src/index.ts`
- `packages/cli/src/check-cli-contract.ts`
- `packages/client/src/index.ts`
- `apps/desktop/src/local-ipc.ts`
- `apps/desktop/src/local-ipc-protocol.ts`
- `apps/desktop/src/check-local-ipc-protocol.ts`
- `packages/claude/src/hook-settings.ts` (reuse project-local hook writer by passing settings path)

## Technical approach

### CLI command shape

```bash
openpets configure [--agent claude] [--pet <id>] [--cwd <path>] [--yes]
```

Defaults:

- `--agent claude`
- `--cwd process.cwd()`
- configure both MCP and hooks
- local/private project config

### Installed pet discovery

Add a narrow local IPC/client method for the user-run CLI:

```ts
pets.list
```

Return only safe display data:

```ts
{
  ok: true,
  pets: [
    { id, displayName, installed: true, builtIn, broken }
  ],
  defaultPetId
}
```

The CLI uses this to validate `--pet` and power the picker.

### Stable generated commands

Do not write temp/cache paths from `npx @open-pets/cli` into Claude config. Instead make the CLI package self-contained and expose wrapper subcommands:

```bash
openpets mcp --pet fixer
openpets hook --openpets-managed --project-local --pet fixer
```

Generated long-lived commands should use the package version being configured:

```bash
npx -y @open-pets/cli@0.0.0 mcp --pet fixer
npx -y @open-pets/cli@0.0.0 hook --openpets-managed --project-local --pet fixer
```

The `mcp` wrapper starts the existing OpenPets MCP server implementation. The `hook` wrapper delegates to the existing Claude hook handler.

This avoids storing an absolute path into npm's temporary `npx` cache.

### Claude MCP configuration

Use Claude’s own CLI for local project MCP setup when available:

```bash
claude mcp add-json openpets '<json>' --scope local
```

JSON shape:

```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@open-pets/cli@0.0.0", "mcp", "--pet", "fixer"],
  "env": {}
}
```

Spawn `claude mcp add-json` with `cwd` set to the resolved target project directory so Claude's local MCP scope attaches to the intended project.

Do not directly mutate `~/.claude.json` in this phase; delegate that to `claude mcp add-json`.

### Claude project-local hooks

Write hooks directly to:

```text
<project>/.claude/settings.local.json
```

Use existing `installClaudeHooks(settingsPath, commandMode, selectedPetId)` with a CLI-appropriate command mode/path if possible. If needed, add a small command builder option so the npm CLI writes hook commands that call the installed npm Claude CLI:

```bash
npx -y @open-pets/cli@0.0.0 hook --openpets-managed --project-local --pet fixer
```

Project-local hooks are private and should not require committing repo files.

Before writing hooks:

- resolve and validate the target project directory;
- reject symlinked `<project>/.claude` directories;
- ensure `<project>/.claude/settings.local.json` resolves inside the target project;
- preserve existing non-OpenPets settings and hooks.

### Interactive picker

If `--pet` is missing:

- list usable installed non-broken pets, including built-in unless explicitly disallowed later
- use a simple stdin/stdout numbered picker
- no extra MCP/hooks questions

### Preflight and idempotency

Before writing anything:

- verify OpenPets desktop is reachable and supports `pets.list`;
- verify the selected pet is installed and usable;
- verify Claude Code is available on PATH;
- verify target project path and hook path safety;
- build the version-pinned wrapper commands.

If any preflight fails, do not write MCP or hooks.

If a local Claude MCP entry named `openpets` already exists, `configure` should replace it by invoking Claude's add/update flow for the same server name when supported by `claude mcp add-json`; if Claude refuses, fail clearly before writing hooks.

## Risks and tradeoffs

- Adding public local IPC pet listing is a new surface. Keep it read-only and minimal.
- Invoking `claude` CLI can fail if Claude Code is unavailable on PATH. CLI should print the exact failure and next step.
- Project-local hooks and Claude local MCP scope are stored in different places by Claude design.
- Npm `npx` hook commands may run package resolution at hook time. This is acceptable for npm-first CLI but may be slower than future app-installed shim.
- Generated commands are version-pinned for stability; users may need to rerun configure after upgrading OpenPets CLI.

## Security/privacy notes

- Do not expose filesystem install/remove/default mutation over MCP.
- Validate project path and pet id before writes.
- Only write inside `<project>/.claude/settings.local.json` for hooks.
- Reject unsafe project-local hook paths, including symlinked `.claude` directories.
- Preserve non-OpenPets settings/hooks.
- Do not log prompt/hook payloads or secrets.

## Test/check plan

- Unit/contract check for CLI arg parsing and generated Claude config.
- Contract check that existing hooks are preserved and OpenPets-managed hooks are replaced.
- Mocked `claude` binary check for exact `add-json` argv, `--scope local`, JSON shape, and spawned cwd.
- Noninteractive `--pet` check; missing `--pet` non-TTY failure/picker behavior.
- Generated command version pinning check.
- Project hook writer rejects symlinked `.claude` / unsafe cwd.
- IPC protocol check for `pets.list` validation/result shape.
- MCP public tool list remains exactly `openpets_status`, `openpets_say`, `openpets_react`.
- Package build/test:

```bash
pnpm --filter @open-pets/cli build
pnpm --filter @open-pets/cli test
pnpm --filter @open-pets/client test
pnpm --filter @open-pets/desktop build
pnpm --filter @open-pets/desktop test
pnpm --filter @open-pets/claude test
```

## Manual verification guide

1. Run OpenPets desktop.
2. In a test project, run:

   ```bash
   npx @open-pets/cli configure --pet fixer
   ```

3. Confirm command succeeds without MCP/hooks prompts.
4. Confirm Claude local MCP entry for the project targets `--pet fixer`.
5. Confirm `<project>/.claude/settings.local.json` contains OpenPets hooks with `--pet fixer`.
6. Start Claude in that project.
7. Confirm `/mcp` shows OpenPets connected.
8. Submit a prompt and confirm hook bubble appears on fixer.
9. Call `openpets_status` and confirm actual target is fixer.

## Oracle plan review

Oracle reviewed the Phase 17 plan and recommended revision before implementation.

## Oracle feedback disposition

- Fixed: Changed long-lived generated commands from temporary absolute package paths to self-contained, version-pinned `npx -y @open-pets/cli@<version> mcp/hook ...` wrappers.
- Fixed: Removed final confirmation prompt from Phase 17; `--yes` is accepted as no-op compatibility only.
- Fixed: Spec now requires spawning `claude mcp add-json` with `cwd` set to the target project.
- Fixed: Added project-local hook path safety requirements for symlinked `.claude` and inside-project resolution.
- Fixed: Deferred `openpets install <pet-id>` out of Phase 17 to avoid expanding mutation/security scope.
- Fixed: Added preflight/idempotency requirements before writing MCP/hooks.
- Fixed: Added version pinning, mocked Claude CLI tests, project hook safety tests, noninteractive CLI tests, and MCP public tool-list regression to test plan.

## Implementation notes

- Added `openpets` bin in `@open-pets/cli`.
- Added `configure`, `mcp`, and `hook` CLI command paths.
- Added read-only `pets.list` local IPC/client method.
- `configure --pet <id>` writes config without requiring the desktop app to be running; omitting `--pet` still queries the running desktop app for interactive pet selection.
- Claude MCP config is written through `claude mcp add-json openpets <json> --scope local` with `cwd` set to the target project.
- Project-local hooks are prepared before MCP mutation and written only after MCP configuration succeeds.
- Generated MCP/hook commands use version-pinned `npx -y @open-pets/cli@<version>` wrappers.
- CLI-generated npm hook timeout is `10` seconds to tolerate `npx` startup.
- Project-local hooks include the internal `--project-local` marker so global OpenPets hooks can detect project-specific OpenPets hooks and skip themselves, preventing duplicate default/project pet reactions.
- `--force` / `--replace` removes any existing local Claude MCP `openpets` entry before adding the new one.
- Hidden maintainer flag `--local-dev` writes local `node <repo>/packages/cli/dist/index.js ...` commands for pre-release testing; it is intentionally omitted from user help.

## Oracle implementation review

Oracle approved the implementation after one revision pass.

- Fixed: Avoid partial config by parsing/merging hook settings before MCP mutation and writing hooks only after MCP succeeds.
- Fixed: Reject symlinked `.claude`, non-file `settings.local.json`, malformed hook event arrays, and unsafe project-local hook paths.
- Fixed: Added `publishConfig.access = public` for npm-distributed packages.
- Fixed: Added `pets.list` response shape validation.
- Fixed: Added mocked Claude CLI cwd/argv/JSON test.
- Fixed: Increased CLI-generated hook timeout and added MCP wrapper signal forwarding.
- Fixed: Added global-hook duplicate prevention using explicit project-local hook marker detection.
- Fixed: Hardened project-local hook detection to reject symlinks/non-files, cap settings size, and ensure the settings path stays under the Claude project dir.
- Fixed: Hook CLI boundaries reject `--pet` with a missing value.
- Accepted: Generated commands are pinned to the package version; release must publish `@open-pets/cli`, `@open-pets/client`, `@open-pets/claude`, and `@open-pets/mcp` at the same version.
