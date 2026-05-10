# Phase 08C: Test Harness and Regression Pack

## Goal

Add a lightweight, explicit test workflow for OpenPets before Phase 09 onboarding glues together pet management, MCP routing, Claude setup, and hooks.

The project already has useful `check-*.ts` contract checks. This phase standardizes how those checks are run, adds a top-level `pnpm test`, and expands regression coverage around the riskiest recent features without introducing a heavy test stack prematurely.

## Non-goals

- No full Electron UI automation yet.
- No Playwright/Spectron-style end-to-end suite.
- No large migration to a test framework unless a clear gap appears.
- No broad refactors of feature code solely to satisfy tests.
- No network-dependent tests.
- No tests that mutate real Claude user settings, real pet installs, or real desktop app state.

## User-visible/manual outcome

Developers can run:

```bash
pnpm test
pnpm check
```

and get clear regression coverage for core OpenPets behavior. `pnpm check` remains the pre-commit/phase gate; `pnpm test` becomes the focused regression test command.

## Acceptance criteria

- Root package has a `test` script.
- These packages get `test` scripts in this phase because they already have meaningful contract checks:
  - `apps/desktop`
  - `packages/client`
  - `packages/mcp`
  - `packages/claude`
- Packages without meaningful runtime checks yet may keep `test` as type/build-only or omit it with a documented reason:
  - `packages/cli`
  - `packages/pet-format`
- Existing `check-*.ts` files are either:
  - included in package `test`, or
  - clearly kept in `check` with `test` delegating to them.
- Package tests run against fresh built artifacts. Either package `test` builds first, or root `pnpm test` builds before invoking tests. Avoid stale `dist` false positives.
- Prefer `check = typecheck + build + test` at each package so `check` cannot drift away from regression tests.
- `pnpm check` still passes.
- `pnpm test` passes.
- Tests are deterministic and do not require:
  - a running Electron app.
  - a real Claude installation.
  - network access.
  - writes to real `~/.claude/settings.json`.
  - writes to real OpenPets user data, except via isolated temp directories or pure in-memory checks.
- Tests using temp directories clean them up and do not depend on the current working directory except explicit repo-relative fixture paths.
- Claude settings install/uninstall tests must pass explicit temp settings paths; they must never call install/uninstall against the default real Claude settings path.
- Regression coverage includes at least:
  - MCP tool contract and safe speech validation.
  - MCP lease status/fallback behavior where currently factored.
  - Claude MCP command previews for published/local dev modes.
  - Claude hook event mapping.
  - Claude hook stdout/privacy/speech safety expectations.
  - Claude settings install/update/uninstall on temp fixture files.
  - Local dev command path validation failure cases where practical.
  - Desktop lease manager behavior.
  - Desktop IPC protocol validation.
  - Pet zip safety/catalog validation checks.
- Test output names should make it obvious what failed.
- `docs/implementation-process.md` or the phase spec documents the new test/check distinction.

## Proposed files/directories

- `package.json`
  - Add root `test` script.
- Workspace package `package.json` files:
  - Add package-level `test` scripts where appropriate.
- Existing check files:
  - `apps/desktop/src/check-*.ts`
  - `packages/client/src/check-*.ts`
  - `packages/mcp/src/check-*.ts`
  - `packages/claude/src/check-*.ts`
- Optional new fixture/check files:
  - `packages/claude/src/check-claude-local-dev.ts` if not folded into existing checks.
- `docs/testing.md`
  - Short developer-facing description of `test` vs `check`, package expectations, and isolation rules.
- `docs/phases/phase-08c-test-harness-regression-pack.md`

## Technical approach

### Keep it simple first

Continue using Node-executed TypeScript-built contract checks for now:

```text
pnpm typecheck && pnpm build && node dist/check-*.js
```

Reasons:

- This matches the current repo pattern.
- It keeps dependencies minimal.
- The current risky logic is mostly pure Node contract logic, not browser UI.
- We can still add Vitest later when richer assertions/mocking become painful.

### Define command semantics

Recommended command meanings:

```text
pnpm test   = deterministic regression tests only
pnpm check  = typecheck + build + tests + static/smoke checks required before commits
```

Package `check` should call package `test` after typecheck/build when practical:

```text
check = typecheck + build + test
test = node dist/check-*.js ...
```

If a package needs `test` to build first for standalone use, keep that behavior explicit and avoid stale `dist` artifacts. The implementation should avoid duplicating long command lists more than necessary.

### Avoid real user config/state

Claude settings tests must use temp files/directories. Desktop state tests should use existing pure helpers or isolated temp paths only. If a test cannot avoid real Electron `app.getPath("userData")`, keep it out of `pnpm test` and document it as manual/Electron-only.

### Regression priorities

Add or strengthen tests around bugs found during manual verification:

- Local dev mode should not accidentally use published `npx` commands.
- Local hook command paths are shell-quoted safely.
- Local dev mode validates missing/invalid dist paths where practical.
- Hook commands produce empty stdout.
- Hook CLI direct invocation produces empty stdout for normal and malformed fixture payloads.
- Explicit pet rendering should not regress to giant installed-pet image data URLs where this can be checked without Electron.
- Benign IPC client disconnect errors should not fail response handling where factored.

## Risks and tradeoffs

- Adding a framework now may slow progress. Mitigation: standardize existing checks first.
- Pure Node checks cannot catch every Electron UI issue. Mitigation: keep manual verification for tray/windows and add UI automation later.
- Too many duplicated scripts can become hard to maintain. Mitigation: keep `test`/`check` scripts simple and consistent.
- Tests that touch real Claude/OpenPets state would be risky. Mitigation: temp fixtures only.

## Security/privacy notes

- Tests must not read or write real `~/.claude/settings.json`.
- Tests must not print secrets, local tokens, or full user config payloads.
- Fixtures should be synthetic and minimal.
- Any local path assertions should avoid requiring a specific user home path.

## Test/check plan

- Run `pnpm test`.
- Run `pnpm check`.
- Confirm no test writes to real Claude settings.
- Confirm temp fixtures are cleaned up.
- Confirm test failures are understandable by temporarily reviewing script names/output.

## Manual verification guide

After implementation:

1. Run:

   ```bash
   pnpm test
   pnpm check
   ```

2. Confirm both pass.
3. Confirm no real Claude settings were modified.
4. Confirm no desktop app launch is required for tests.
5. Confirm the command split is understandable:
   - `test` = deterministic regression tests.
   - `check` = full pre-commit validation.

## Oracle plan review

Reviewed. Oracle approved deferring Vitest and standardizing existing Node contract checks first.

Oracle requested clearer package scope, fresh built artifact behavior, temp-dir cleanup/isolation requirements, explicit no-real-Claude-settings guard, `check` calling `test` to prevent drift, and direct hook CLI stdout assertion.

## Oracle feedback disposition

Fixed:

- Listed packages expected to get `test` scripts now and packages allowed to defer.
- Required tests to run against fresh built artifacts and preferred `check = typecheck + build + test`.
- Added temp-dir cleanup/current-working-directory isolation acceptance criteria.
- Added explicit guard that Claude settings install/uninstall tests must use temp settings paths.
- Added `docs/testing.md` to proposed files.
- Added direct hook CLI stdout assertion to regression priorities.
