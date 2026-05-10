# Phase 16 — Claude Hook Pet Routing

## Goal

When a Claude integration is configured with a selected pet, Claude hook speech/reactions should route to the same selected pet as the MCP server instead of always using the default desktop pet.

## Non-goals

- Per-project Claude hook installation. Current Claude hooks remain global user settings.
- Changing MCP lease behavior.
- Removing the default-pet fallback when no hook pet is configured.

## User-visible/manual outcome

- Installing/updating Claude hooks from Integrations with pet `fixer` writes hook commands containing `--pet fixer`.
- Prompt-submit hook speech appears on the fixer pet, matching the selected Claude integration pet.
- If no selected pet is configured for hooks, hook events continue targeting the default pet.

## Acceptance criteria

- `open-pets-claude hook --openpets-managed --pet <id>` validates `<id>` and passes it to hook handling.
- Hook handling acquires a short OpenPets lease for the configured pet and passes that `leaseId` into `say`/`react`.
- Integrations hook doctor/install uses the selected pet when checking/writing hooks.
- Hook status text makes the target explicit.
- Invalid hook `--pet` values are rejected at CLI boundary.

## Proposed files/directories

- `packages/claude/src/cli.ts`
- `packages/claude/src/hooks.ts`
- `packages/claude/src/hook-settings.ts`
- `packages/claude/src/check-claude-hooks.ts`
- `apps/desktop/src/agent-setup.ts`

## Technical approach

- Extend the Claude hook CLI with `--pet` parsing using the same pet-id validation as MCP setup.
- Include `--pet <id>` in generated Claude hook commands when a selected pet exists.
- During hook runtime, acquire a short lease for the configured pet and pass the returned lease id to the OpenPets client call.
- Do not release hook leases immediately; rely on the existing short TTL so the explicit pet remains visible briefly after the hook event.
- Preserve default-pet behavior when no `--pet` is present.

## Risks and tradeoffs

- Hooks are global in `~/.claude/settings.json`, so installing hooks for `fixer` makes hook events target `fixer` globally. Per-project hook routing is deferred.
- If the selected pet is missing or broken, local IPC falls back to default pet using existing lease fallback behavior.

## Security/privacy notes

- Hook `--pet` is validated against the safe pet-id pattern before use.
- Hook speech validation still rejects code, paths, URLs, and secret-like content.
- No hook payload content is logged by default.

## Test/check plan

- `pnpm --filter @open-pets/claude build`
- `pnpm --filter @open-pets/claude test`
- `pnpm --filter @open-pets/desktop build`
- `pnpm --filter @open-pets/desktop test`
- `pnpm --filter @open-pets/mcp test`

## Manual verification guide

1. Open Integrations.
2. Select `fixer` for Claude.
3. Update/install optional Claude hooks.
4. Confirm `~/.claude/settings.json` hook commands include `--pet fixer`.
5. Start Claude in a project using the `--pet fixer` MCP config.
6. Submit a prompt.
7. Confirm hook speech/reaction appears on the fixer pet, not the default pet.

## Oracle plan review

Skipped as emergency bugfix; implementation review requested immediately after the targeted fix.

## Oracle feedback disposition

Implementation review via Oracle found no blocking issues.

- Fixed: Added CLI-level regression coverage for `open-pets-claude hook --pet fixer` and invalid `--pet bad/pet`.
- Fixed: Hook status message now states whether hook events target the selected pet or default pet.
- Fixed: Hook CLI validates `--pet` at the boundary instead of relying only on IPC fallback.
- Fixed: Hook action journal commands include `--pet <id>` when applicable.
- Accepted: Hook leases are not immediately released; they rely on the existing 15s TTL to keep the explicit pet visible after hook events.
