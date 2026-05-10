# Phase 19 — OpenCode Integration Plan

## Goal

Add full OpenPets support for OpenCode with parity to the current Claude Code integration, without over-splitting implementation work.

Target parity means:

- OpenPets MCP tools available in OpenCode.
- OpenPets instructions installed into OpenCode instructions.
- OpenCode activity drives pet reactions and short safe speech.
- CLI project setup can route a selected pet to a project.
- Desktop Integrations can detect/configure/remove/doctor OpenCode setup.

## Current Claude integration to mirror

Claude support has four layers:

1. **MCP tools**
   - Public tools stay exactly `openpets_status`, `openpets_say`, `openpets_react`.
   - MCP server: `packages/mcp/src/server.ts`.
   - CLI wrapper: `packages/cli/src/index.ts` → `openpets mcp --pet <id>`.
   - Claude command/config helpers: `packages/claude/src/claude-code.ts`.
   - Desktop setup: `apps/desktop/src/agent-setup.ts`.

2. **Instructions/memory**
   - Claude writes `~/.claude/openpets.md` and imports it from `~/.claude/CLAUDE.md`.
   - Implementation: `apps/desktop/src/claude-memory.ts`.
   - Safety pattern: managed markers, preserve user content, private file modes, no symlink writes, max file size.

3. **Hooks/events**
   - Claude hooks write managed command entries to `~/.claude/settings.json` or project-local `.claude/settings.local.json`.
   - Implementation: `packages/claude/src/hook-settings.ts`, `packages/claude/src/hooks.ts`, `packages/claude/src/hook-messages.ts`.
   - Current mapping:
     - `UserPromptSubmit` → `thinking` + throttled speech.
     - `PreToolUse Edit/Write/MultiEdit` → `editing`.
     - `PreToolUse Bash` test command → `testing`, otherwise `running`.
     - other `PreToolUse` → `working`.
     - `PermissionRequest` → `waiting` + forced short speech.
     - `Notification` → `waving`.
     - `Stop` → `success` + throttled speech.
     - `StopFailure` → `error` + throttled speech.

4. **CLI project setup**
   - `openpets configure --agent claude --pet <id> --cwd <project>` configures project-local Claude MCP and hooks.
   - Explicit `--pet` works without desktop app; omitted `--pet` uses local IPC `pets.list`.

## OpenCode source findings

OpenCode has enough native extension surface for parity, but OpenCode support should use config + plugin, not Claude-style hooks.

- **MCP config**
  - OpenCode config has `mcp` at `v1/opencode/packages/opencode/src/config/config.ts` lines 220-229.
  - Local MCP shape is in `v1/opencode/packages/opencode/src/config/mcp.ts` lines 5-19:
    - `{ type: "local", command: string[], environment?, enabled?, timeout? }`.
  - `opencode mcp add` is interactive, so automated OpenPets setup should directly edit JSON/JSONC config with the same shape.

- **Config locations**
  - Global config uses OpenCode global config dir, with `OPENCODE_CONFIG_DIR` override support.
  - Project configs include `opencode.json`, `opencode.jsonc`, `.opencode/opencode.json`, `.opencode/opencode.jsonc`.
  - OpenCode's own MCP add path resolution checks `opencode.json` before `opencode.jsonc`, then `.opencode/*`: `v1/opencode/packages/opencode/src/cli/cmd/mcp.ts` lines 399-415.
  - OpenCode writes config with `jsonc-parser`: `v1/opencode/packages/opencode/src/cli/cmd/mcp.ts` lines 417-431.

- **Instructions**
  - OpenCode config supports `instructions: string[]`: `v1/opencode/packages/opencode/src/config/config.ts` lines 238-240.
  - OpenCode config merge concatenates instruction arrays without duplicates: lines 54-59.

- **Plugins/events**
  - OpenCode plugin hook surface: `v1/opencode/packages/plugin/src/index.ts` lines 222-333.
  - Useful hooks include `event`, `chat.message`, `tool.execute.before`, `tool.execute.after`, `command.execute.before`.
  - Do **not** rely on `permission.ask`; permissions should be handled through plugin `event` for bus event `permission.asked`.
  - OpenCode awaits plugin hooks directly, so plugin hooks must return immediately and run OpenPets calls fire-and-forget.

## Non-goals

- Do not fork or modify `v1/opencode/`.
- Do not add new public MCP tools.
- Do not expose pet install/remove/default controls through MCP or OpenCode plugin tools.
- Do not add a network listener or external SSE watcher unless plugin-based events prove insufficient.
- Do not send prompts, raw commands, code, logs, tool output, URLs, secrets, or file paths to pet speech.
- Do not write project-local absolute local/bundled paths by default.

## Recommended subphase sequence

This should be **4 subphases**, not 6. That keeps risk separated without making the project feel fragmented.

### Phase 19A — OpenCode Foundation

**Goal:** Add OpenCode config helpers, previews, safe write primitives, and shared speech/event safety. No plugin runtime or UI yet.

**Scope:**

- Add `packages/opencode` or equivalent module.
- Build helpers for:
  - best-effort OpenCode detection;
  - global/project config path discovery;
  - JSON/JSONC read/write;
  - MCP/instructions/plugin previews;
  - installed/missing/stale/error status classification.
- Extract shared speech categories, message picking, speech validation, and throttling from Claude into a neutral reusable module.
- Keep Claude behavior unchanged.
- Define exact config target behavior:
  - follow OpenCode's own existing file order: `opencode.json`, `opencode.jsonc`, `.opencode/opencode.json`, `.opencode/opencode.jsonc`;
  - if no project config exists, create `.opencode/opencode.jsonc`;
  - published mode is default for project config;
  - local/bundled absolute paths are explicit dev/global-only, never default project config.
- Add safety primitives:
  - max config size;
  - reject symlinked file and parent dirs;
  - no writes on invalid JSON/JSONC;
  - backup before update/replace/remove;
  - temp-file + rename atomic writes.

**Acceptance criteria:**

- OpenCode MCP preview shape is:

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

- Tests cover JSON/JSONC parsing, candidate ordering, idempotency, stale entries, invalid config, backups, max size, symlink rejection, and speech safety.
- Claude checks still pass unchanged.

**Checks:**

- `pnpm --filter @open-pets/opencode check`
- `pnpm --filter @open-pets/claude check`

### Phase 19B — OpenCode Plugin Runtime

**Goal:** Add the OpenCode plugin that reacts to OpenCode activity. No desktop UI yet.

**Scope:**

- Implement a valid OpenCode server plugin package/entry.
- Package contract must satisfy OpenCode loader expectations:
  - npm package export/main compatible with OpenCode;
  - default export exposes the OpenCode plugin shape;
  - file/local plugin has a stable `id`;
  - local/bundled dynamic import smoke test exists.
- Plugin hooks must return immediately.
- OpenPets calls run fire-and-forget with internal `.catch()` and debug-only logging.
- Use short client timeouts, but do not await them in OpenCode hooks.
- Lease strategy:
  - acquire a lease when configured with `pet`;
  - pass `leaseId` to `say`/`react`;
  - prefer cached lease with safe fallback, or per-event acquisition if simpler and non-blocking.
- Event mapping:
  - `chat.message` → `thinking` + throttled speech.
  - `tool.execute.before` edit/write/patch tool names → `editing`.
  - `tool.execute.before` shell/bash tool with test-like category → `testing`.
  - `tool.execute.before` shell/bash tool otherwise → `running`.
  - other tools → `working`.
  - plugin `event` with `permission.asked` → `waiting` + approval-needed speech.
  - stable session completion/error events, if verified during implementation → `success` / `error`.
  - avoid raw prompt/command/output text in speech.

**Acceptance criteria:**

- Plugin can be imported from built output.
- Plugin hook functions return without awaiting OpenPets IPC.
- Unit tests cover event classification and fire-and-forget failure swallowing.
- Manual OpenCode config can load the plugin and trigger reactions.

**Checks:**

- `pnpm --filter @open-pets/opencode check`
- Manual plugin load smoke test.

### Phase 19C — CLI Project Setup for OpenCode

**Goal:** Extend `openpets configure` to support project-local OpenCode setup.

**Scope:**

- Add `--agent opencode` alongside existing `--agent claude`.
- Keep Claude CLI behavior unchanged.
- With explicit `--pet`, configuration can run without desktop app.
- Without `--pet`, use local IPC pet picker as Claude does.
- Write project config entries for:
  - `mcp.openpets`;
  - OpenPets instructions file, e.g. `.opencode/openpets.md`;
  - OpenPets plugin spec/options.
- Print exact files changed and restart guidance.
- Warn that `.opencode/opencode.jsonc` can be committed and may contain the selected pet id.
- Do not require `opencode` binary on PATH to write project config; warn if not found.

**Acceptance criteria:**

- `openpets configure --agent opencode --pet fixer --local-dev --cwd <tmp>` writes expected project config offline.
- Re-running is idempotent.
- `--force` replaces only OpenPets-managed entries.
- Unknown agents still fail clearly.
- Claude project setup tests still pass.

**Checks:**

- `pnpm --filter @open-pets/cli check`
- `pnpm --filter @open-pets/opencode check`
- `pnpm --filter @open-pets/claude check`

### Phase 19D — Desktop Integration, Packaging, Docs, Hardening

**Goal:** Add OpenCode to Desktop Integrations and close out docs/packaging/cross-platform hardening.

**Scope:**

- Add OpenCode card next to Claude Code.
- Desktop OpenCode setup target is explicitly **global OpenCode config**, not project config.
- If project setup is desired from desktop, defer to a later phase with a project directory selector.
- Global setup can:
  - detect OpenCode best-effort;
  - install/replace/remove global MCP entry;
  - install/update global OpenPets instructions;
  - install/update/remove global OpenPets plugin;
  - show previews and copy manual snippets;
  - show clear status and backups.
- Preserve Claude UI/actions.
- Package bundled OpenCode plugin/CLI resources safely:
  - no true `app.asar` paths;
  - no symlinked bundled entry;
  - dynamic-import smoke test for bundled plugin path.
- Update README and mapping docs.
- Manual verification covers:
  - invalid config;
  - custom `OPENCODE_CONFIG_DIR`;
  - OpenCode absent;
  - removal safety;
  - packaged bundled plugin;
  - project/global precedence;
  - macOS/Windows/Linux path differences where available.

**Acceptance criteria:**

- Desktop UI clearly says OpenCode desktop setup is global.
- No global config write occurs without explicit user action.
- Remove only removes OpenPets-managed entries.
- OpenCode absent on PATH does not prevent showing config status/previews.
- Packaged app can locate bundled OpenCode plugin and CLI resources.
- Docs explain exact files touched and CLI project setup vs desktop global setup.
- `pnpm check` passes.

**Checks:**

- `pnpm --filter @open-pets/desktop check`
- `pnpm --filter @open-pets/opencode check`
- `pnpm check`

## Security/privacy requirements for every subphase

- Never include prompt text, command text, file paths, tool output, code, logs, URLs, or secrets in pet speech.
- Classify tools using tool names and coarse categories only.
- Validate pet ids with the same strict regex as Claude.
- Reject symlinked config/instruction/plugin write targets.
- Keep writes inside the selected project or OpenCode config dir.
- Back up before update/replace/remove once writes are implemented.
- No new TCP/HTTP surface.
- Plugin failures must never break or delay OpenCode; hooks must return immediately.

## Oracle plan review

Oracle reviewed the first all-in-one Phase 19 plan and found the architecture viable but too broad and not implementation-ready.

### Blockers found

- Desktop target scope was ambiguous: global vs project setup.
- `permission.ask` assumption was wrong; use `event` hook for `permission.asked`.
- Plugin hooks are awaited by OpenCode; OpenPets work must be fire-and-forget, not merely timeout-bounded.
- Plugin package/path contract was underspecified.
- Config precedence and write targets needed tightening.
- Data-loss protections needed hard requirements.
- `.opencode` is not private; project config can be committed.
- Manual verification was too happy-path-only.

## Oracle feedback disposition

- **Fixed:** Split one large phase into 4 subphases, not 6.
- **Fixed:** Desktop setup is global-only unless a later project picker is added.
- **Fixed:** Permission mapping uses `event`/`permission.asked`, not `permission.ask`.
- **Fixed:** Plugin hooks must return immediately and run OpenPets calls fire-and-forget.
- **Fixed:** Added plugin package/path contract and bundled import smoke requirement.
- **Fixed:** Aligned existing config candidate order with OpenCode's own `mcp add` order.
- **Fixed:** Added invalid JSONC, max size, symlink, backup, and atomic write requirements.
- **Fixed:** Removed “private-ish” wording for `.opencode` and added commit warning.
- **Fixed:** Combined desktop, packaging, docs, and hardening into one closeout phase to avoid oversplitting.

## Implementation closeout

Phase 19A–19D are implemented in the v2 workspace:

- `packages/opencode` provides OpenCode config helpers, strict managed-entry classification, safe global/project writes, and the OpenCode plugin runtime.
- `packages/cli` supports `openpets configure --agent opencode` for project-local setup.
- Desktop Integrations supports global OpenCode setup/removal/preview/copy, with packaged CLI resource checks and published plugin configuration.
- README and mapping docs explain OpenCode project-local vs desktop-global setup and safe speech constraints.

Validation completed with `pnpm check` after @oracle implementation review.
