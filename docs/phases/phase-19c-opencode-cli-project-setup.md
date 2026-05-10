# Phase 19C — OpenCode CLI Project Setup

## Goal

Extend the OpenPets CLI so users can configure a project for OpenCode with one command:

```bash
npx @open-pets/cli configure --agent opencode --pet fixer
```

This writes project-local OpenCode config for OpenPets MCP, OpenPets instructions, and the OpenPets OpenCode plugin.

## Non-goals

- No Desktop Integrations OpenCode UI.
- No global OpenCode setup from desktop.
- No project directory picker UI.
- No OpenCode runtime plugin changes beyond using Phase 19B's plugin package/export.
- No new public MCP tools.
- No OpenCode source changes under `v1/opencode/`.
- No real user config writes in tests.

## User-visible/manual outcome

From a project directory, users can run:

```bash
npx @open-pets/cli configure --agent opencode --pet fixer
```

Expected result:

- OpenCode project config contains `mcp.openpets`.
- OpenCode project config includes OpenPets instruction file `.opencode/openpets.md`.
- OpenCode project config includes OpenPets plugin spec/options targeting `fixer`.
- Starting OpenCode from that project gives OpenPets MCP tools and plugin-driven reactions for `fixer`.

If `--pet` is omitted, the CLI uses the same installed-pet picker as Claude setup and therefore requires OpenPets desktop to be running.

## Acceptance criteria

- `parseConfigureArgs` accepts `--agent opencode` and still accepts/keeps `--agent claude` behavior unchanged.
- Unsupported agents still fail clearly.
- `openpets configure --agent opencode --pet <id> --cwd <project>` runs without requiring OpenPets desktop.
- `openpets configure --agent opencode` without `--pet` uses local IPC pet listing/picker like Claude.
- OpenCode setup does not require `opencode` binary on `PATH`; if detection is added, it is warning-only.
- Project path validation rejects symlinked project roots.
- OpenCode config writes use Phase 19A helpers:
  - project config candidate selection;
  - all existing project config candidate scanning before writing;
  - JSON/JSONC parsing/updating;
  - backup/temp/atomic write safety;
  - symlink and escape rejection.
- If no project OpenCode config exists, create `.opencode/opencode.jsonc`.
- Existing unrelated OpenCode config keys are preserved.
- Existing non-OpenPets MCP/plugin/instruction entries are preserved.
- Existing matching OpenPets entries are idempotent.
- Existing stale managed OpenPets entries are updated.
- Custom/foreign `mcp.openpets` or OpenPets-like plugin/instruction entries must not be overwritten. In this phase, fail clearly and tell the user to edit/remove the custom entry manually.
- `--force` may replace stale managed OpenPets entries, but must not overwrite custom/foreign entries.
- Written project config uses published mode by default:

```jsonc
{
  "mcp": {
    "openpets": {
      "type": "local",
      "command": ["npx", "-y", "@open-pets/cli@0.0.0", "mcp", "--pet", "fixer"],
      "enabled": true
    }
  },
  "instructions": [".opencode/openpets.md"],
  "plugin": [["@open-pets/opencode@0.0.0", { "pet": "fixer" }]]
}
```

- With `--local-dev`, generated MCP config may use `node <current cli dist/index.js> mcp --pet fixer`, but the plugin spec should remain package-based unless a safe local plugin file path policy is implemented in a later phase.
- The package-based plugin spec must be version-pinned to the same package version used for generated MCP commands, e.g. `@open-pets/opencode@<version>`.
- The managed instruction file `.opencode/openpets.md` is written with OpenPets managed markers.
- Instruction file writes must be safe:
  - reject symlinked `.opencode/openpets.md`;
  - reject oversized instruction files;
  - preserve user content outside managed markers;
  - upsert the managed OpenPets block if the expected path exists without a managed block;
  - backup before destructive update;
  - temp-file + rename atomic write;
  - no instruction write if config planning fails.
- CLI output prints:
  - configured agent (`OpenCode`);
  - target project path;
  - selected pet id/name;
  - config file path changed;
  - instruction file path changed;
  - a warning that `.opencode/opencode.jsonc` and `.opencode/openpets.md` can be committed and contain the selected pet id;
  - restart guidance for OpenCode.
- Tests cover offline explicit-pet setup, idempotency, preserving unrelated config, custom/foreign conflict refusal, symlink rejection, and Claude regression.

## Proposed files/directories

Likely changed files:

- `packages/cli/package.json`
- `packages/cli/src/index.ts`
- `packages/cli/src/check-cli-contract.ts`
- `packages/opencode/src/opencode-config.ts`
- `packages/opencode/src/opencode-previews.ts`
- `packages/opencode/src/opencode-status.ts`
- `packages/opencode/src/check-opencode-foundation.ts`

Possible new file:

- `packages/opencode/src/opencode-project-setup.ts`

## Technical approach

### CLI flow

Keep existing Claude flow intact and branch in `configureProject` by `options.agent`:

```ts
if (options.agent === "claude") return configureClaudeProject(options)
if (options.agent === "opencode") return configureOpenCodeProject(options)
```

Update `ConfigureOptions.agent` to `"claude" | "opencode"`.

### OpenCode project setup helper

Prefer putting most OpenCode-specific write logic in `packages/opencode`, not in the CLI, so desktop Phase 19D can reuse the same primitives.

Potential API:

```ts
prepareOpenCodeProjectSetup({
  projectDir,
  petId,
  cliVersion,
  commandMode,
  cliEntryPath,
}): PreparedOpenCodeProjectSetup

writePreparedOpenCodeProjectSetup(prepared): OpenCodeProjectSetupResult
```

The helper should:

1. Validate project root.
2. Select config write target.
3. Read and classify **all existing project config candidates** because OpenCode can merge top-level and `.opencode` configs.
4. Fail on custom/foreign/conflicting OpenPets entries anywhere in those candidates.
5. Read the selected write target or `{}`.
6. Classify selected-target OpenPets entries for idempotent updates.
7. Add/update:
   - `mcp.openpets`;
   - `instructions` containing `.opencode/openpets.md` once;
   - `plugin` containing version-pinned `@open-pets/opencode@<version>` once with `{ pet }`.
8. Plan `.opencode/openpets.md` managed block upsert.
9. Plan safe config writes via Phase 19A helpers.
10. Execute writes only after all config and instruction write plans have succeeded.

The setup must be two-phase: validate/classify/plan all writes first, then execute. If any plan fails, write nothing.

### Instruction file content

Use the same guidance as Claude memory, adapted for OpenCode:

- OpenPets MCP tools may be available.
- Use `openpets_say` for meaningful short status/personality messages.
- Keep messages brief, user-facing, and non-sensitive.
- Do not include code, logs, secrets, URLs, or file paths.
- Use `openpets_react` for visual feedback.
- Use `openpets_status` only when checking availability or target pet.
- Do not spam every internal step.

### Conflict policy

Status helpers from Phase 19A distinguish `installed`, `needs_update`, `custom`, and `conflict`.

For Phase 19C:

- `installed`: leave as-is unless generated content differs only in managed block, then refresh instruction block.
- `needs_update`: update managed entries.
- `not_installed`: install entries.
- `custom` / `conflict`: fail clearly and do not write config.

This avoids overwriting user-owned `openpets` entries.

If the expected instruction path is present but lacks the managed block, treat it as an instruction `needs_update`: upsert the managed block while preserving existing file content outside managed markers.

### Offline behavior

Reuse existing `resolveConfiguredPet` behavior:

- explicit `--pet` validates syntax only and does not require desktop;
- omitted `--pet` queries installed pets through local IPC.

## Risks and tradeoffs

- Project `.opencode/opencode.jsonc` and `.opencode/openpets.md` can be committed. CLI must warn clearly.
- Direct JSONC editing risks data loss. Use existing parse guards, backups, temp writes, and no-write-on-error policy.
- Package-based plugin spec assumes `@open-pets/opencode` is published alongside CLI. This is correct for published mode; local plugin path setup is deferred.
- `--local-dev` only affects MCP command in this phase. Plugin local-dev path is deferred to avoid unsafe path/config churn.

## Security/privacy notes

- Do not write outside the project root.
- Reject symlinked project roots and unsafe config paths.
- Preserve unrelated OpenCode config.
- Do not overwrite custom/foreign OpenPets-like entries.
- Do not perform partial writes; if any plan fails, no config or instruction file should be written.
- Do not expose prompts, code, logs, URLs, paths, or secrets in instruction text beyond generic warnings.
- Tests must use temp directories only.

## Test/check plan

- `pnpm --filter @open-pets/opencode check`
- `pnpm --filter @open-pets/cli check`
- `pnpm --filter @open-pets/claude check`
- `pnpm check` after implementation review fixes.

Specific tests:

- `parseConfigureArgs(["--agent", "opencode", "--pet", "fixer"])` works.
- Unsupported agent still throws.
- Offline explicit-pet OpenCode setup writes config without calling local IPC.
- Missing `--pet` still calls pet picker/listing.
- New project creates `.opencode/opencode.jsonc` and `.opencode/openpets.md`.
- Existing `opencode.json` is preferred over `.opencode/opencode.jsonc` as write target.
- Existing unrelated config keys/MCP/plugin/instructions are preserved.
- Conflicts across multiple project config candidate files are detected before writing.
- Re-running setup is idempotent.
- Stale managed OpenPets entries are updated.
- Custom `mcp.openpets` refuses without writing.
- Custom OpenPets-like plugin/instruction refuses without writing.
- Existing `.opencode/openpets.md` without managed block gets managed block added while preserving user text.
- Instruction symlink/oversized file is rejected without config writes.
- Symlink project/config paths are rejected.
- Claude CLI tests still pass.

## Manual verification guide

After implementation and review:

1. Run `pnpm --filter @open-pets/cli check`.
2. Run `pnpm check`.
3. In a temporary project, run:

```bash
node /path/to/packages/cli/dist/index.js configure --agent opencode --pet fixer --cwd /tmp/openpets-opencode-test --local-dev
```

4. Confirm `.opencode/opencode.jsonc` contains `mcp.openpets`, `.opencode/openpets.md` instruction path, and `@open-pets/opencode` plugin spec.
5. Confirm `.opencode/openpets.md` contains OpenPets managed markers.
6. Re-run the command and confirm config remains idempotent.
7. Add a custom `mcp.openpets` entry and confirm setup refuses without overwriting.
8. Confirm real user OpenCode config was not touched.

## Oracle plan review

Oracle reviewed the initial Phase 19C spec and found blockers:

- Must scan all project config candidates before writing, not only selected write target.
- Instruction file write safety was under-specified.
- Partial-write/data-loss sequencing was undefined.
- Published plugin spec should be version-pinned.
- Existing expected instruction path without managed block needed a preserve-and-upsert policy.

## Oracle feedback disposition

- **Fixed:** Required scanning/classifying all existing project config candidates before selecting a write target.
- **Fixed:** Added safe instruction file write requirements: symlink/size rejection, preserve user content, backup, temp+rename, no write if config planning fails.
- **Fixed:** Required two-phase plan-all-then-execute sequencing to avoid partial writes.
- **Fixed:** Required version-pinned `@open-pets/opencode@<version>` plugin spec.
- **Fixed:** Clarified expected instruction path without managed block is `needs_update` and should upsert the managed block while preserving existing content.
