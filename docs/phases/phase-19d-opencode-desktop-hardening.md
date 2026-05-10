# Phase 19D — OpenCode Desktop Integration, Packaging, Docs, Hardening

## Goal

Add OpenCode to the Desktop Integrations window for global OpenCode setup, package the OpenCode runtime safely, and finish OpenCode docs/hardening.

This is the final OpenCode integration phase after:

- 19A: config foundation;
- 19B: plugin runtime;
- 19C: CLI project setup.

## Non-goals

- No desktop project directory picker.
- No desktop project-local OpenCode setup. Desktop setup is explicitly global.
- No OpenCode source changes under `v1/opencode/`.
- No new public MCP tools.
- No new network listener or external SSE watcher.
- No pet install/remove/default controls via OpenCode.

## User-visible/manual outcome

The Integrations window shows an OpenCode card next to Claude Code.

Users can open OpenCode details and:

- See best-effort OpenCode detection/status.
- Select pet routing.
- Install/update/remove global OpenPets OpenCode setup.
- Inspect/copy global MCP/instructions/plugin config preview.
- See exact global files that would be touched.

Desktop copy must clearly state that OpenCode desktop setup is **global**. Users who want per-project setup should use:

```bash
openpets configure --agent opencode --pet <id>
```

## Acceptance criteria

- Integrations hub includes an enabled OpenCode card with status and Configure/Install actions.
- Claude integration UI/actions continue to work unchanged.
- OpenCode detail view clearly says setup is global, not project-local.
- OpenCode global setup uses Phase 19A/19C primitives where possible:
  - global config path discovery;
  - safe JSON/JSONC update planning;
  - managed instruction block upsert;
  - custom/foreign conflict refusal;
  - backup/temp/atomic writes.
- Global setup must have its own explicit helper contract because Phase 19C helpers are project-root scoped:
  - validate global config dir/candidate parents before reading;
  - scan all global candidates before writing;
  - refuse custom/foreign entries anywhere;
  - preserve the effective owner file for global `plugin`/`instructions` arrays because higher-precedence arrays can shadow lower arrays;
  - if managed OpenPets entries live in a stale higher-precedence overlay while user arrays live lower, migrate managed entries to the user array owner and clean the stale managed overlay;
  - refuse if user `plugin` and `instructions` arrays live in different global config files, or if a higher-precedence empty array shadows lower user entries;
  - otherwise choose the single managed owner file if one exists;
  - fail if managed entries span multiple global files;
  - otherwise write to the highest-precedence existing global config file;
  - only create `opencode.jsonc` when no global config exists.
- No global OpenCode config write happens without explicit user action.
- OpenCode absent on `PATH` does not block preview/status; it only affects the detection message.
- Desktop global setup writes/updates:
  - global config `mcp.openpets`;
  - global OpenPets instructions file;
  - global `plugin` spec for version-pinned `@open-pets/opencode@<version>`.
- Global setup uses bundled command mode when packaged and local mode in dev where appropriate.
- Published plugin specs use the `@open-pets/opencode` package version, or the shared release version if the workspace moves to one synchronized release version. Do not derive the plugin package version from an unrelated Electron app-only version.
- Dev/local absolute-path command mode is developer-only and must only be used behind the existing local-dev toggle. Real/default global setup uses published packages in dev and bundled CLI command mode in packaged desktop.
- Bundled MCP command is explicit: `node <app.asar.unpacked>/node_modules/@open-pets/cli/dist/index.js mcp --pet <id>`.
- Desktop packaged dependencies must include `@open-pets/cli` for bundled global MCP setup.
- Because OpenCode will spawn `node`, bundled setup must warn/block clearly if `node` is unavailable on PATH, matching the Claude packaged command policy.
- Plugin config remains published/version-pinned `@open-pets/opencode@<version>` in this phase. The packaged desktop may contain/import `@open-pets/opencode` for previews/smoke checks, but global OpenCode itself will resolve the published plugin package unless a future bundled plugin path policy is added.
- UI/docs must explain that OpenCode may need npm/network access to resolve the published OpenCode plugin package unless it is already cached/installed.
- Bundled command paths must point outside true `app.asar` into `app.asar.unpacked` resources.
- Packaged resources include `@open-pets/opencode`, `@open-pets/agent-events`, `@open-pets/client`, CLI/MCP dependencies, and plugin server export.
- Packaged smoke checks verify:
  - `@open-pets/opencode/dist/plugin.js` exists;
  - `@open-pets/opencode/package.json` exists;
  - `@open-pets/agent-events/dist/index.js` exists;
  - dynamic import of the packaged OpenCode plugin server works.
- Remove action removes only OpenPets-managed global entries/blocks and preserves unrelated OpenCode config.
- Removal writes config first, then cleans the now-unused instruction block/file. If instruction cleanup fails after config removal, stale unused OpenPets text is safer than leaving config pointing at missing instructions.
- Managed-entry signatures are:
  - MCP: `mcp.openpets` with `type: "local"`, `enabled: true`, and command matching the OpenPets CLI published/local/bundled command shapes for `mcp` plus optional `--pet <id>`;
  - instructions: exactly `<global OpenCode config dir>/openpets.md` for desktop global setup and a file containing the OpenPets managed markers;
  - plugin: `@open-pets/opencode` or `@open-pets/opencode@<version>`, optionally as `[spec, { pet }]`.
  - Any OpenPets-like entry that does not match these signatures is custom/foreign and must be refused rather than overwritten or removed.
- Config, instruction, temp, and backup files use private `0600` modes where supported; created config/instruction directories use private `0700` modes where supported.
- Docs explain:
  - CLI project setup vs desktop global setup;
  - files touched;
  - how to remove/reconfigure;
  - privacy/speech constraints.
- `pnpm check` passes.

## Release checklist

- Confirm the version-pinned `@open-pets/opencode@<version>` written by desktop global setup has been published to npm before shipping a packaged desktop release that advertises OpenCode setup.

## Proposed files/directories

Likely changed files:

- `apps/desktop/package.json`
- `apps/desktop/src/agent-setup.ts`
- `apps/desktop/src/windows.ts`
- `apps/desktop/preload.cjs`
- `apps/desktop/src/check-packaging-contract.ts`
- `packages/opencode/src/opencode-project-setup.ts`
- `packages/opencode/src/opencode-config.ts`
- `packages/opencode/src/check-opencode-foundation.ts`
- `README.md`
- `docs/mapping.md`

Possible new files:

- `apps/desktop/src/opencode-global-setup.ts`

## Technical approach

### Desktop scope

Desktop setup is global only.

Use OpenCode global config discovery from Phase 19A:

- `OPENCODE_CONFIG_DIR` if present;
- platform/XDG default config dir;
- candidate files `config.json`, `opencode.json`, `opencode.jsonc`.

If existing global `plugin` or `instructions` arrays are present, write OpenPets into the effective owner file for those arrays so OpenPets does not create a higher-precedence array that shadows user entries. If those user arrays are split across files, or if a higher-precedence empty array already shadows lower user entries, refuse with a manual consolidation message. If no array owner exists, update an existing managed owner, otherwise write the highest-precedence existing global config file (`opencode.jsonc`, then `opencode.json`, then `config.json`). If no global config exists, create global `opencode.jsonc` in the OpenCode config dir.

### Global setup data model

Add OpenCode status/action data alongside existing Claude snapshot, without breaking Claude fields.

Possible approach:

- keep `getAgentSetupSnapshot()` returning Claude fields for compatibility;
- add `opencodeStatus`, `opencodePreview`, `opencodeInstructionStatus`, `opencodePluginStatus` fields;
- add OpenCode-specific actions such as:
  - `opencode-install`;
  - `opencode-remove`;
  - `opencode-refresh` handled by snapshot reload;
  - `opencode-copy-config` in preload only.

Avoid overloading Claude `configure` / `remove` semantics if it makes state ambiguous.

### Global config writes

Use a two-phase plan-all-then-execute model:

1. Validate global config dir/path safety.
2. Read/classify global candidates.
3. Refuse custom/foreign OpenPets-like entries.
4. Plan config update.
5. Plan instruction file upsert.
6. Execute instruction write before config write.

Instruction upsert must preserve content outside managed markers.

### Removal

Removal should:

- remove `mcp.openpets` only if managed;
- remove OpenPets instruction path from `instructions` only if managed;
- remove OpenPets plugin spec only if managed;
- remove only OpenPets managed block from instruction file;
- preserve unrelated config and user text.

If entries are custom/foreign, show a warning and do not remove.

Removal must also use two-phase destructive write safety:

1. Validate/read all global candidates safely.
2. Classify exact managed entries.
3. Refuse custom/foreign entries.
4. Fail if managed entries span multiple global files.
5. Plan all config/instruction writes before executing.
6. Backup + atomic-write config and instruction changes.
7. Preserve user text outside OpenPets managed instruction markers.

### UI

Add enabled OpenCode card in the integrations grid.

OpenCode detail can be simpler than Claude's initial UI but must include:

- status card;
- pet routing select;
- global scope warning;
- install/update button;
- remove button;
- refresh button;
- config preview JSON;
- instruction file path/details;
- action result.

### Packaging

Desktop `package.json` should include workspace dependencies needed at runtime:

- `@open-pets/cli`;
- `@open-pets/opencode`;
- `@open-pets/agent-events` if not pulled transitively in packaged output.

Packaging checks should assert these are built and present.

### Docs

Update docs with OpenCode support:

- `openpets configure --agent opencode --pet fixer` for project setup.
- Desktop OpenCode setup is global.
- OpenPets speech safety and MCP tool usage remain unchanged.

## Risks and tradeoffs

- Desktop global config can affect all OpenCode projects. UI must make this explicit.
- Global config path conventions may vary; use Phase 19A helpers and avoid guessing beyond tested defaults.
- Removal must not delete user-owned OpenCode settings.
- Packaging plugin imports can fail if `exports`/asar paths are wrong; add smoke checks.
- Adding OpenCode fields to the existing Claude-focused snapshot can make preload code complex; keep integration-specific DOM code separated where practical.

## Security/privacy notes

- Never write global config without explicit user action.
- Preserve unrelated global OpenCode config.
- Do not overwrite custom/foreign OpenPets-like entries.
- Do not create network listeners.
- Keep speech guidance: no code, logs, secrets, URLs, or file paths in pet speech.
- Packaged paths must not point into true `app.asar` for executable/plugin resources.

## Test/check plan

- `pnpm --filter @open-pets/opencode check`
- `pnpm --filter @open-pets/desktop check`
- `pnpm check`

Specific checks:

- Agent Setup HTML contains enabled OpenCode card/details and global warning.
- Preload binds OpenCode install/remove/refresh without breaking Claude bindings.
- Desktop backend reports OpenCode status when binary is absent.
- Global setup uses temp fixtures in tests/checks only.
- Temp `OPENCODE_CONFIG_DIR` global install/update/remove.
- All global candidates are scanned before writing.
- Managed owner in lower-priority candidate is updated, not duplicated.
- Custom/foreign conflict refusal.
- Symlinked global config dir/candidate/instruction file rejection.
- Remove preserves unrelated config and user instruction text.
- Managed entries spanning multiple global candidate files fail safely.
- Invalid JSON/JSONC or oversized global candidates block setup/removal writes.
- Stale managed MCP/plugin/pet/version entries update cleanly.
- Packaged generated MCP command contains `app.asar.unpacked`, never true `app.asar`.
- Packaged Node-on-PATH block/warning path exists in desktop install handling and remains a manual packaged-app verification item.
- Global removal creates backups and uses temp/atomic writes.
- Copy preview action copies the OpenCode config preview without requiring writes.
- Packaging contract checks built `@open-pets/opencode` and `@open-pets/agent-events` resources.
- Packaged smoke imports OpenCode server plugin export.
- Docs mention CLI project setup vs desktop global setup.

## Manual verification guide

After implementation and review:

1. Run `pnpm check`.
2. Run `pnpm dev:desktop`.
3. Open Integrations.
4. Confirm Claude still works as before.
5. Confirm OpenCode card is enabled.
6. Open OpenCode detail.
7. Confirm it says desktop setup is global.
8. Install OpenCode global integration in a temp `OPENCODE_CONFIG_DIR` environment if practical.
9. Confirm global config has OpenPets MCP/instructions/plugin entries.
10. Confirm remove preserves unrelated config and removes only managed OpenPets entries.
11. Package dir build if practical and confirm packaged smoke checks pass.

## Oracle plan review

Oracle reviewed the initial Phase 19D spec and found blockers:

- Global setup safety contract was under-specified.
- Removal needed a two-phase destructive-write contract.
- Bundled MCP command/package path was ambiguous.
- Packaged plugin behavior was unclear: published plugin spec vs bundled desktop copy.
- Tests/checks needed explicit global setup/removal fixture coverage.

## Oracle feedback disposition

- **Fixed:** Added explicit global helper contract for safe all-candidate scanning, owner selection, custom refusal, and `opencode.jsonc` creation.
- **Fixed:** Added two-phase removal safety contract with backups/atomic writes and user text preservation.
- **Fixed:** Defined bundled MCP command via packaged `@open-pets/cli` and Node-on-PATH requirement.
- **Fixed:** Clarified plugin config remains published/version-pinned while packaged plugin resources are for desktop imports/smoke checks in this phase.
- **Fixed:** Added explicit global setup/removal fixture coverage requirements.

## Implementation closeout

- Desktop OpenCode global setup, removal, preview, and copy actions are implemented in the Integrations window.
- Automated checks now cover OpenCode global install/remove status transitions, JSONC preview planning, bundled `app.asar.unpacked` command shape, strict managed-entry classification, packaged resource presence, and plugin smoke import.
- `pnpm check` passed after implementation review and strict managed-entry hardening.
- Remaining release-time manual item: confirm the version-pinned `@open-pets/opencode@<version>` is published before shipping a desktop build that advertises OpenCode global setup.
