# Phase 10A: Desktop Package Hardening

## Goal

Add a reliable current-platform desktop packaging checkpoint for the OpenPets tray app and document the MVP validation matrix, while explicitly deferring the unresolved packaged Claude command distribution path to Phase 10B.

Phase 10A should prove that the packaged desktop app itself can launch and run the core local experience: tray, default pet, onboarding, Pet Manager, settings, local state, assets, and local IPC startup/cleanup behavior.

## Non-goals

- No real packaged Claude end-to-end demo unless the user already has published `@open-pets/*` packages available.
- No npm package publishing.
- No bundled packaged MCP/Claude resource command mode.
- No signed/notarized public release.
- No app store work.
- No auto-update system.
- No start-at-login feature.
- No new pet/catalog/agent features.
- No broad UI redesign.

Phase 10B should choose the Claude distribution path:

- publish `@open-pets/mcp` and `@open-pets/claude`, or
- bundle unpacked MCP/Claude command resources inside the packaged app and point Agent Setup at those paths.

## User-visible/manual outcome

From a clean checkout, the user can run:

```bash
pnpm test
pnpm check
pnpm package:desktop:dir
```

Then launch the generated current-platform packaged app and verify:

- OpenPets starts as a tray/menu bar app.
- The default pet appears and uses packaged assets.
- First-run onboarding can complete.
- Pet Manager opens and can show installed pets/catalog state.
- Settings opens and can update preferences.
- The app writes local IPC discovery state in the user-specific runtime location.
- Quit exits cleanly.

The phase also creates `docs/mvp-validation.md` with a platform matrix, unsigned-app notes, package commands, cleanup notes, and the remaining Phase 10B packaged-Claude gap.

## Acceptance criteria

- A desktop packaging tool/config exists for current-platform local validation.
- Packaging is Node/pnpm based and does not require Bun.
- Root scripts exist:
  - `pnpm package:desktop:dir`
  - optionally `pnpm package:desktop` if installer packaging is cheap after `--dir` passes.
- Desktop package scripts exist for package/build/check flow.
- Root package script performs a topological build of desktop dependencies before packaging, not only `apps/desktop` TypeScript.
- Packaging includes required runtime files:
  - compiled desktop `dist/**`,
  - `preload.cjs`,
  - `assets/tray-icon.png`,
  - bundled/default pet runtime assets or generated-renderer code,
  - workspace runtime dependencies required by the desktop app, including built `@open-pets/claude` and `@open-pets/client` files because Agent Setup imports Claude helpers at startup,
  - package metadata needed by Electron.
- Packaging must not leave pnpm symlinks that escape the packaged app, especially symlinks back to `packages/*` in the checkout.
- Packaging excludes obvious repo bulk/secrets/user data:
  - `v1/`,
  - `web/`,
  - `docs/phases/`,
  - `.env*`,
  - Claude settings/backups,
  - app user data,
  - build caches.
- Package content checks verify expected config/files and guard against obvious inclusion mistakes where practical.
- A post-package content check verifies the generated package directory contains main/preload/assets/runtime workspace deps and does not contain forbidden repo bulk/secrets where practical.
- Packaged resource path assumptions are audited and fixed if needed:
  - tray icon loading,
  - preload loading,
  - built-in pet loading,
  - internal data URLs/task windows,
  - local IPC discovery file paths.
- Renderer security remains unchanged:
  - `nodeIntegration: false`,
  - `contextIsolation: true`,
  - `sandbox: true`,
  - CSP/navigation guards retained.
- Local dev command mode for Agent Setup remains unavailable or clearly dev-only in packaged builds.
- Published/npx Claude commands remain documented as requiring real published packages; packaged Claude end-to-end is explicitly deferred to Phase 10B.
- In Phase 10A packaged app verification, do not apply Claude MCP/hooks unless `@open-pets/*` packages are actually published and intentionally being tested.
- `docs/mvp-validation.md` documents:
  - platform validation matrix for macOS/Windows/Linux,
  - current-platform package command,
  - unsigned local-app warnings,
  - how to launch the packaged output,
  - cleanup/uninstall notes,
  - which MVP demo rows are verified in Phase 10A vs deferred to Phase 10B.
- `pnpm test` passes.
- `pnpm check` passes.
- `pnpm package:desktop:dir` succeeds on the current platform, or the exact blocker and next action are documented.

## Proposed files/directories

- `package.json`
  - Add root packaging scripts.
- `apps/desktop/package.json`
  - Add package scripts and packaging dev dependency, likely `electron-builder`.
- `apps/desktop/electron-builder.yml`
  - Define local validation packaging config: stable app id, product name, output directory, explicit files/resources, disabled publish, and signing/notarization deferral.
- `.gitignore`
  - Ensure package output directory is ignored.
- `apps/desktop/src/assets.ts`
  - Harden packaged resource path lookup if needed.
- `apps/desktop/src/built-in-pet.ts`, `apps/desktop/src/pet-window.ts`, or related files
  - Harden packaged built-in pet asset lookup only if package testing exposes a failure.
- `apps/desktop/src/check-packaging-contract.ts`
  - Deterministic packaging config/content guard where practical.
- `docs/mvp-validation.md`
  - MVP package/manual validation checklist and matrix.
- `docs/phases/phase-10a-desktop-package-hardening.md`

## Technical approach

### Packaging tool

Use `electron-builder` for Phase 10A unless implementation testing reveals a blocker.

Initial target should be unpacked/current-platform packaging first:

```bash
pnpm package:desktop:dir
```

Installer targets can be added only after `--dir` works and if the config is straightforward. The phase can still pass with `--dir` as the stable packaging checkpoint if installers need more platform-specific work.

### Build order

Packaging must not assume only `apps/desktop` needs building.

Root scripts should build relevant workspace dependencies before packaging. For example:

```json
{
  "package:desktop:dir": "pnpm build && pnpm --filter @open-pets/desktop package:dir"
}
```

If full workspace build is too slow but reliable dependency filtering is easy, it can be narrowed later.

### Package contents

Start with a conservative `electron-builder` file list that packages only the desktop app runtime. Do not package the entire repository.

Candidate includes:

- `dist/**`
- `preload.cjs`
- `assets/**`
- built workspace runtime dependencies needed by desktop imports, especially `@open-pets/claude` and `@open-pets/client`
- `package.json`

If built-in pet assets live outside those paths or are resolved through `app.getAppPath()`, include them explicitly and adjust path helpers. If the bundled default pet is generated/rendered from compiled code rather than external files, document that in the packaging contract.

The generated package must not depend on symlinks that escape to the source checkout. If pnpm workspace layout causes symlink leakage, use an explicit staging/deploy step rather than shipping checkout-relative links.

### pnpm workspace handling

Do not add root `.npmrc` hoisting/linker changes preemptively.

If `electron-builder` fails because of pnpm workspace dependency layout:

1. Prefer explicit file/resource inclusion and package-local fixes.
2. Consider a staging/deploy step.
3. Only add root pnpm linker changes if necessary, with documentation and another `pnpm check` run.

### Claude packaging limitation

Phase 10A must not pretend packaged Claude works while packages are private/unpublished.

Agent Setup published mode may still show `npx -y @open-pets/...`, but `docs/mvp-validation.md` should state that a packaged end-to-end Claude demo requires Phase 10B unless those packages have been published.

Local dev command mode should stay disabled in packaged builds, because absolute checkout paths are not suitable for a distributed app.

### Validation docs

`docs/mvp-validation.md` should include a table like:

```text
Area                      Phase 10A status
Tray/default pet packaged  Verify now
Onboarding packaged        Verify now
Pet Manager packaged       Verify now
Claude MCP via npx         Deferred unless packages published
Claude hooks via npx       Deferred unless packages published
Packaged bundled commands  Phase 10B
```

## Risks and tradeoffs

- **This is not full MVP distribution yet.** It intentionally defers packaged Claude commands to avoid hiding a publish/bundle decision.
- **electron-builder + pnpm may need staging.** Avoid global linker changes unless required.
- **Unsigned apps may show OS warnings.** Accept this for local validation and document it.
- **Cross-platform validation cannot be completed from one OS.** Define the matrix now; mark non-current platforms unverified until tested.
- **Packaging can reveal path assumptions.** Fix concrete packaged-mode failures only.

## Security/privacy notes

- Do not weaken renderer sandbox/context isolation/CSP.
- Do not introduce TCP/HTTP control surfaces.
- Do not include secrets, local app data, Claude settings, or backups in package output.
- Keep local IPC local-only and token-gated.
- Claude config mutation remains confirmation-based through existing Agent Setup behavior.
- Unsigned package output is for local MVP validation, not public trust distribution.

## Test/check plan

Run:

```bash
pnpm test
pnpm check
pnpm package:desktop:dir
```

Add/extend deterministic checks for:

- packaging config exists,
- package scripts exist,
- required runtime files are included by config or copied resources,
- obviously forbidden repo/user-data patterns are not included by config,
- generated package output contains main/preload/assets and workspace runtime deps after `package:desktop:dir`,
- generated package output does not contain symlinks escaping the package directory,
- root packaging command is available.

Manual verification covers actual packaged app launch and resource loading.

## Manual verification guide

1. Run:

```bash
pnpm test
pnpm check
pnpm package:desktop:dir
```

2. Launch the generated app from the package output.
3. Confirm tray icon appears.
4. Confirm default pet appears and can be shown/hidden/paused/resumed.
5. Complete or reset onboarding and confirm it behaves correctly in packaged mode.
6. Open Pet Manager and confirm installed pets/catalog state renders.
7. Open Settings and toggle a preference; restart packaged app and confirm persistence.
8. Confirm local IPC discovery is created in a per-user location while the app runs and cleaned/stale-safe on quit as documented.
   - While the packaged app is running, use an existing checkout client smoke/status command if available to verify discovery, token, and status endpoint against the packaged app.
9. Open Agent Setup and confirm local dev mode is unavailable/clearly dev-only in packaged builds.
10. Confirm docs clearly mark packaged Claude MCP/hooks as deferred to Phase 10B unless npm packages are published. Do not apply Claude MCP/hooks from the packaged app during Phase 10A unless intentionally testing published packages.
11. If catalog/fixture is available, install a pet and set it as default in packaged mode; if unavailable, mark catalog install as unverified and record the catalog error.
12. Quit from tray and confirm clean exit.

## Oracle plan review

Reviewed by Oracle after user chose to split broad Phase 10 into Phase 10A/10B.

Blocker:

- Even with Claude end-to-end deferred, desktop imports `@open-pets/claude` through Agent Setup, and that imports `@open-pets/client`. Phase 10A must explicitly include those workspace runtime deps' built files or use staging/deploy; packaging only desktop `dist`, preload, assets, and package metadata is likely insufficient.

Should-fix feedback:

- Require no symlinks escaping the packaged app, especially pnpm workspace symlinks to `packages/*`.
- Make electron-builder config requirements explicit: stable `appId`, `productName`, output dir, `publish` disabled, signing/notarization deferred, output ignored.
- Add post-package content checks, not only config checks.
- Add manual local IPC smoke step from checkout against packaged app.
- Strengthen Agent Setup warning: do not apply Claude MCP/hooks in Phase 10A packaged app unless packages are actually published.
- Pet Manager verification should include install/set-default if catalog/fixture is available, or explicitly mark catalog install unverified if unavailable.

Nice-to-have feedback:

- Keep Phase 10A to `electron-builder --dir` first.
- Prefer staging/deploy over root linker changes if pnpm fights builder.
- Clarify bundled default pet assets if generated rather than file assets.

Verdict: original packaged-Claude blocker is resolved by the split. Phase 10A is nearly implementation-ready after making workspace runtime dependency inclusion a hard acceptance criterion.

## Oracle feedback disposition

Fixed:

- Added hard acceptance criterion for packaged workspace runtime deps, especially `@open-pets/claude` and `@open-pets/client`.
- Added no-escaping-symlink acceptance criterion.
- Made electron-builder config expectations explicit.
- Added post-package content check requirement.
- Added local IPC smoke verification step.
- Strengthened packaged Agent Setup warning not to apply Claude MCP/hooks unless packages are actually published.
- Added Pet Manager install/set-default manual check when catalog/fixture is available, with explicit unverified note if unavailable.
- Clarified default pet assets may be generated/runtime code rather than external files.

Accepted:

- Start with `--dir` packaging first; installers are optional after `--dir` passes.
- Prefer staging/deploy over root pnpm linker changes if needed.

Deferred:

- Packaged Claude end-to-end command distribution remains Phase 10B.

## Oracle implementation review

Reviewed by Oracle after implementation.

Blockers: none.

Should-fix feedback:

- Manually verify the packaged GUI before closing Phase 10A: tray, default pet, onboarding, Pet Manager, Settings, IPC smoke, quit cleanup.
- Tighten or explicitly disposition package over-inclusion. Current unpacked app may include workspace package `src/`, `tsconfig.json`, built check scripts, and source maps. This is acceptable for local inspectable Phase 10A if documented, but does not fully match runtime-only packaging intent.
- Extend package output contract checks to third-party runtime deps such as `yauzl` and transitive deps.

Nice-to-have feedback:

- Document `npmRebuild: false` assumption as acceptable because current deps are JS-only/no native modules.
- Keep `asar: false` for Phase 10A only and revisit for release hardening.
- Exact script assertions in packaging checks are acceptable at current scale, though less brittle assertions may be useful later.

Verdict: acceptable for Phase 10A after manual packaged-app verification.

## Oracle implementation feedback disposition

Fixed:

- Added package output assertions for `yauzl` and its runtime helpers/transitive dependencies.
- Documented Phase 10A package over-inclusion as an intentional local/inspectable packaging tradeoff in `docs/mvp-validation.md`.
- Documented `npmRebuild: false` as safe only while runtime deps are JavaScript-only.

Deferred:

- Runtime-only ASAR packaging. Phase 10A intentionally uses unpacked output for inspectable package checks; release hardening should revisit ASAR/runtime-only output before public distribution.

Needs manual verification:

- Packaged GUI launch and full Phase 10A manual checklist must be completed by the user before committing/closing this phase.

Final Oracle re-check:

- Blockers: none.
- Remaining implementation/spec should-fix: none.
- Phase gate still remaining: user manual packaged GUI verification before closing Phase 10A.
- Verdict: proceed to user manual verification; do not close/commit phase until that checklist passes.
