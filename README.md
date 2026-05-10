# OpenPets 2.0

OpenPets 2.0 is a tray-first desktop companion app for coding agents.

This repository contains the fresh v2 workspace. The `v1/` folder is reference material only, and the existing `web/` app remains outside the v2 workspace.

## Development baseline

- Node.js 20+
- pnpm 11+
- TypeScript
- No Bun runtime requirement for v2

## Install

```bash
pnpm install
```

## Checks

```bash
pnpm check
pnpm typecheck
pnpm build
```

## Desktop development

```bash
pnpm --filter @open-pets/desktop dev
```

Phase 01 desktop behavior is tray/menu-bar first. It should not open a dashboard window on startup.

## Workspace layout

```text
apps/desktop        Electron desktop app shell
packages/client     @open-pets/client, local IPC client
packages/mcp        @open-pets/mcp, MCP stdio server
packages/claude     @open-pets/claude, Claude integration package
packages/opencode   @open-pets/opencode, OpenCode config/plugin integration
packages/agent-events shared safe agent event speech helpers
packages/cli        @open-pets/cli, explicit user-run CLI commands
packages/pet-format @open-pets/pet-format, pet/catalog format types
```

## Agent integrations

- Claude Code: configure from Desktop Integrations or with `openpets configure --agent claude --pet <id>`.
- OpenCode project-local setup: use `openpets configure --agent opencode --pet <id>` from a project. This writes `.opencode/opencode.jsonc` when no OpenCode config exists, adds `.opencode/openpets.md`, and configures OpenPets MCP plus the OpenCode plugin for that project.
- OpenCode desktop setup: use Desktop Integrations → OpenCode for global setup. This writes OpenCode's global config directory only after explicit user action, adds a global `openpets.md` instruction file, and can be removed from the same screen. The MCP command uses bundled desktop CLI resources in packaged builds; the OpenCode plugin spec remains the published/version-pinned `@open-pets/opencode` package, so OpenCode may need npm/network access unless that package is already cached/installed.

OpenPets MCP tools remain `openpets_status`, `openpets_say`, and `openpets_react`. Speech must stay short and must not include code, logs, secrets, URLs, or file paths.

To reconfigure, rerun the CLI command for a project or use Replace/Install in Desktop Integrations for global OpenCode setup. To remove global desktop OpenCode setup, use the OpenCode Remove action; unrelated OpenCode config and user text outside OpenPets managed markers are preserved.

The v2 workspace intentionally includes only:

```text
apps/*
packages/*
```

It does not include `v1/**` or `web/**`.
