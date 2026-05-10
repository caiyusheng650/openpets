# Phase 19A — OpenCode Foundation

## Goal

Add the non-UI foundation for OpenCode integration:

- OpenCode config discovery and safe JSON/JSONC helpers.
- OpenCode MCP/instructions/plugin previews and status classification.
- Shared speech safety utilities reusable by Claude hooks and the future OpenCode plugin.

This phase should not install a working OpenCode plugin, change Desktop Integrations UI, or extend `openpets configure --agent opencode` yet. It prepares the safe primitives for those later phases.

## Non-goals

- No OpenCode runtime plugin implementation.
- No Desktop Integrations OpenCode card.
- No CLI `--agent opencode` user-facing command yet.
- No writes to real user OpenCode config during tests.
- No changes to public MCP tools; they remain exactly `openpets_status`, `openpets_say`, `openpets_react`.
- No fork or modification of `v1/opencode/`.

## User-visible/manual outcome

No direct user-visible feature is expected yet.

Developers should be able to run checks and see that OpenPets can safely build and classify OpenCode config previews in isolated temp fixtures.

## Acceptance criteria

- Add an OpenCode integration package/module, likely `packages/opencode`, with build/check scripts.
- Provide pure helpers for:
  - best-effort OpenCode executable detection data shape;
  - global/project OpenCode config candidate paths;
  - JSON/JSONC parsing and update planning;
  - OpenPets MCP config preview;
  - OpenPets instruction config preview;
  - OpenPets plugin config preview;
  - installed/missing/stale/error status classification.
- OpenCode project config candidate order for existing files follows OpenCode's own MCP add behavior:
  1. `opencode.json`
  2. `opencode.jsonc`
  3. `.opencode/opencode.json`
  4. `.opencode/opencode.jsonc`
- If no project config exists, helpers should plan creation of `.opencode/opencode.jsonc`.
- Status helpers must scan all relevant project config files, not only the chosen write target, because OpenCode can merge top-level and `.opencode` configs.
- Multiple or conflicting OpenPets entries must be classified explicitly instead of silently choosing one.
- Global config discovery is read/status-only in 19A and must define:
  - `OPENCODE_CONFIG_DIR` override support;
  - default config directory derived from platform/XDG conventions;
  - candidate files `config.json`, `opencode.json`, and `opencode.jsonc`;
  - no global writes by default in this phase.
- Published mode is the default for project config previews:

```json
{
  "mcp": {
    "openpets": {
      "type": "local",
      "command": ["npx", "-y", "@open-pets/cli@0.0.0", "mcp", "--pet", "fixer"],
      "enabled": true
    }
  }
}
```

- Local-dev previews may use `node <workspace>/.../cli/dist/index.js`, but project-local absolute paths must not be the default.
- The CLI package version must be an injected parameter to preview builders. `packages/opencode` must not import `@open-pets/cli`, so the later CLI dependency on `@open-pets/opencode` does not create a cycle.
- No-pet MCP preview is valid and means the default OpenPets MCP target:

```json
{
  "type": "local",
  "command": ["npx", "-y", "@open-pets/cli@0.0.0", "mcp"],
  "enabled": true
}
```

- Config safety helpers must support:
  - max config size cap;
  - rejecting symlinked config files;
  - rejecting symlinked relevant parent directories where practical;
  - no write plan on invalid JSON/JSONC;
  - no write plan on invalid OpenCode field types such as `mcp: []`, `instructions: "x"`, or `plugin: {}`;
  - backup-before-write path planning;
  - temp-file + rename write planning.
- Write planning must require a validated project root and reject project-root symlink/escape cases.
- Backup and temp paths must use unique names, avoid overwrite, use exclusive temp-file creation, and keep temp files in the same directory as the target.
- File mode should be private where meaningful on the current platform.
- Existing unrelated OpenCode config keys are preserved by update helpers.
- Existing non-OpenPets MCP/plugin/instruction entries are preserved.
- Managed ownership rules must be explicit:
  - current managed MCP entry = exact expected OpenPets command shape for the selected mode/pet;
  - stale managed MCP entry = recognizable OpenPets package/path/command but outdated;
  - custom/foreign `mcp.openpets` = present but not managed; classify separately and do not overwrite/remove by default;
  - current managed instruction entry = expected OpenPets instruction path plus managed file block;
  - stale managed instruction entry = recognizable OpenPets path/block but outdated;
  - custom/foreign OpenPets-like instruction/plugin entries = classify separately and do not overwrite/remove by default.
- Existing OpenPets-managed entries are idempotently recognized.
- Stale OpenPets-managed entries can be classified as `needs_update` without overwriting in this phase's public surface.
- Shared speech utilities are extracted or introduced so Claude and OpenCode can share:
  - speech categories;
  - message picking;
  - validation rules.
- Throttling extraction is optional in 19A. If included, it must include exact parity tests for Claude state paths, categories, cooldowns, and OpenCode namespacing. Otherwise, defer throttling to Phase 19B.
- Claude hook behavior remains unchanged after extraction/introduction.
- Speech validation still rejects:
  - empty or >140 character messages;
  - newlines;
  - code-like content;
  - URLs;
  - path-like content;
  - secret-looking assignments.
- Tests must not mutate real Claude settings, real OpenCode config, or real OpenPets user data.

## Proposed files/directories

Likely new files:

- `packages/opencode/package.json`
- `packages/opencode/tsconfig.json`
- `packages/opencode/src/index.ts`
- `packages/opencode/src/opencode-config.ts`
- `packages/opencode/src/opencode-previews.ts`
- `packages/opencode/src/opencode-status.ts`
- `packages/opencode/src/check-opencode-foundation.ts`

Possible new shared files/package:

- `packages/agent-events/package.json`
- `packages/agent-events/src/index.ts`
- or a smaller shared module inside an existing package if adding a package is unnecessary.

If a shared package is added, it must not depend on Claude, OpenCode, CLI, desktop, or MCP packages.

Likely changed files:

- `pnpm-workspace.yaml` if a new package is added.
- `packages/claude/src/hooks.ts`
- `packages/claude/src/hook-messages.ts`
- `packages/claude/src/check-claude-hooks.ts`
- root/package check wiring if needed.

## Technical approach

### OpenCode config facts from `v1/opencode/`

- `Config.Info.mcp` exists in `v1/opencode/packages/opencode/src/config/config.ts` lines 220-229.
- Local MCP config shape is in `v1/opencode/packages/opencode/src/config/mcp.ts` lines 5-19:
  - `type: "local"`
  - `command: string[]`
  - optional `environment`, `enabled`, `timeout`.
- OpenCode's interactive `mcp add` resolves project config candidates in `v1/opencode/packages/opencode/src/cli/cmd/mcp.ts` lines 399-415.
- OpenCode's `mcp add` uses `jsonc-parser` update edits in `v1/opencode/packages/opencode/src/cli/cmd/mcp.ts` lines 417-431.
- OpenCode config supports `instructions: string[]` in `v1/opencode/packages/opencode/src/config/config.ts` lines 238-240.
- OpenCode config supports `plugin` array in `v1/opencode/packages/opencode/src/config/config.ts` line 159.

### Config helpers

Use OpenCode-specific config shapes, not Claude shapes.

MCP preview should produce:

```ts
{
  type: "local",
  command: ["npx", "-y", "@open-pets/cli@<version>", "mcp", "--pet", petId],
  enabled: true,
}
```

Instructions preview should plan:

- project: `.opencode/openpets.md` plus `instructions: [".opencode/openpets.md"]`;
- global: a safe OpenCode config dir path decided in later desktop phase.

Plugin preview should be intentionally minimal in 19A because the runtime contract is finalized in Phase 19B. It may build the planned config slot and preserve existing entries, but installed/stale plugin classification should be limited to exact/recognizable OpenPets specs already known. Ambiguous plugin entries must be classified as custom/foreign and left untouched.

### Safe write model

This phase can implement actual helper functions for isolated fixture writes, but tests must only write to temp directories.

Rules:

- Refuse to parse/write oversized config files.
- Refuse symlinked config files.
- Refuse symlinked relevant parent directories, including top-level config parents and `.opencode`, when creating or updating config.
- Refuse symlinked or escaping project roots.
- On parse errors, return an error status and do not produce a write operation.
- On invalid known field types, return an error status and do not produce a write operation.
- For update helpers, create backups before replacing/removing/updating.
- Use an exclusive temp file in the same directory and rename for final write.
- Generate backup/temp names that do not overwrite existing files.

### Shared speech utilities

Keep Claude behavior equivalent. Move pure validation and message selection first; avoid over-refactoring hook runtime.

The shared module should be neutral, not named Claude-specific, so Phase 19B can import it from the OpenCode plugin without circular dependencies.

If throttling is moved in this phase, throttle storage must remain namespaced by agent/integration so Claude and OpenCode do not overwrite each other's cooldown state. If this makes 19A too broad, leave throttling in Claude for now and add a clear Phase 19B follow-up.

## Risks and tradeoffs

- Adding a new package increases workspace wiring but keeps OpenCode code isolated.
- Direct JSONC editing is necessary because OpenCode's `mcp add` is interactive, but it creates data-loss risk; mitigate with parse guards, backups, and atomic writes.
- Plugin config shape may need adjustment in Phase 19B after runtime smoke tests; keep plugin preview centralized so future correction is one-file.
- Shared speech extraction can accidentally change Claude behavior; keep tests focused on parity.

## Security/privacy notes

- Do not read or write real user OpenCode/Claude files in tests.
- Do not expose prompt text, command text, code, logs, file paths, URLs, secrets, or tool output through shared speech utilities.
- Validate pet ids with the same strict rules as Claude.
- Treat config paths as untrusted; reject symlinks and oversized files.
- Preserve unrelated user config.

## Test/check plan

- `pnpm --filter @open-pets/opencode check`
- `pnpm --filter @open-pets/claude check`
- `pnpm --filter @open-pets/desktop check` if packaging/check contracts are touched.

Specific tests/checks:

- Project candidate selection with each possible existing config file.
- No existing config plans `.opencode/opencode.jsonc`.
- Status scanning sees duplicate/conflicting OpenPets entries across top-level and `.opencode` configs.
- Global discovery covers `OPENCODE_CONFIG_DIR`, platform/XDG default path, `config.json`, `opencode.json`, and `opencode.jsonc`.
- MCP preview with and without selected pet.
- Local-dev preview uses `node` command only when explicitly requested.
- JSONC update preserves unrelated fields and comments where practical.
- Invalid known field types return error and no write plan: `mcp: []`, `instructions: "x"`, `plugin: {}`.
- Existing matching OpenPets entries classify as installed.
- Existing stale OpenPets entries classify as needs update.
- Custom/foreign `mcp.openpets` classifies separately and is not treated as managed.
- Non-OpenPets entries are preserved.
- Invalid JSONC returns error and no write plan.
- Oversized config returns error.
- Symlinked config, symlinked top-level parent, symlinked `.opencode`, or symlinked/escaping project root returns error.
- Backup and temp names are unique and do not overwrite existing files.
- Temp writes use exclusive creation in the same directory as the target.
- Backup/temp write helpers write only inside temp fixtures.
- Shared speech validator parity with Claude hook expectations.
- If throttling is extracted, Claude throttle path/category/cooldown parity is covered.
- Cross-platform path fixtures cover POSIX paths, Windows-style paths, spaces in paths, `XDG_CONFIG_HOME`, and `OPENCODE_CONFIG_DIR`.
- Claude hook checks still pass.

## Manual verification guide

After implementation, manually verify:

1. Run `pnpm --filter @open-pets/opencode check`.
2. Run `pnpm --filter @open-pets/claude check`.
3. If desktop/package files changed, run `pnpm --filter @open-pets/desktop check`.
4. Run any fixture/manual check with temp `HOME`, `XDG_CONFIG_HOME`, and `OPENCODE_CONFIG_DIR`.
5. Inspect generated fixture outputs from tests, if any, and confirm OpenCode config shape matches the expected MCP/instructions/plugin previews.
6. Confirm no real `~/.config/opencode`, `~/.claude`, or OpenPets user state changed.

## Oracle plan review

Oracle reviewed the initial Phase 19A spec and found the subphase cut good, but not fully implementation-ready until config ownership, precedence, and write contracts were tightened.

Blockers raised:

- Global config scope was contradictory.
- Write target order and full load/status scanning were underspecified.
- Managed ownership rules were missing.
- JSON/JSONC write contract needed invalid type, symlink, atomicity, backup, and mode details.
- No-pet MCP preview behavior was undefined.
- Package dependency/version source could create cycles.
- Shared speech throttling extraction was too broad.
- Plugin preview/status was premature without a finalized plugin runtime contract.

## Oracle feedback disposition

- **Fixed:** Defined global config discovery/status as read-only in 19A with `OPENCODE_CONFIG_DIR`, default path, and candidate files.
- **Fixed:** Required status helpers to scan all relevant project config files and classify multiple/conflicting entries.
- **Fixed:** Added explicit managed/current/stale/custom ownership rules for MCP, instructions, and plugin-like entries.
- **Fixed:** Added invalid known field type errors, project-root checks, parent symlink rejection, unique backups/temp files, exclusive same-directory temp writes, and private mode requirement where meaningful.
- **Fixed:** Defined no-pet MCP preview as default OpenPets MCP target without `--pet`.
- **Fixed:** Required package version injection so `packages/opencode` does not import `@open-pets/cli`.
- **Fixed:** Narrowed shared speech extraction to categories/messages/validation; throttling is optional only with parity tests, otherwise deferred.
- **Fixed:** Limited plugin preview/status to minimal exact/recognizable specs and custom/foreign preservation until Phase 19B finalizes runtime contract.
