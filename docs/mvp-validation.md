# OpenPets MVP validation

This is the authoritative local MVP closeout checklist for OpenPets 2.0.

The current checkpoint is a macOS local dogfooding package built with `electron-builder --dir`. It is not a public distribution release.

## MVP readiness summary

| Area | Status | Notes |
| --- | --- | --- |
| Tray/menu bar app | Ready for macOS local validation | Validate from the packaged app, not only `pnpm dev:desktop`. |
| Default pet | Ready for macOS local validation | Confirm show/hide, pause/resume, dragging, and restart persistence basics. |
| Default pet animation | Ready for macOS local validation | Confirm bundled sprite animation, left/right drag direction changes, and idle settle. |
| First-run onboarding | Ready for macOS local validation | Can be retested by removing OpenPets app data. |
| Pet Manager | Ready for macOS local validation | Catalog availability may affect install verification. |
| Settings persistence | Ready for macOS local validation | Toggle a preference, restart, and confirm persistence. |
| Local IPC/client smoke | Ready for macOS local validation | Run while the packaged app is open. |
| Claude Agent Setup preview | Ready for macOS local validation | Preview should use packaged bundled `node .../app.asar.unpacked/...` paths. |
| Claude config mutation | Optional/manual only | Requires user confirmation, backups, and cleanup/removal when done. |
| Windows/Linux packages | Unverified | Documented gap until tested on those platforms. |
| Signing/notarization/installers/auto-update | Deferred | Required before public distribution. |

## Artifact identity

| Field | Value |
| --- | --- |
| Workspace package version | `2.0.0` |
| Desktop package version | `2.0.0` |
| Local package command | `pnpm package:desktop:dir` |
| Package output | `apps/desktop/dist-electron/` |
| macOS app output | `apps/desktop/dist-electron/mac-arm64/OpenPets.app` on Apple Silicon |
| Manual tester/date/result | Fill in during validation |

## Prerequisites

- Node.js `>=20`.
- `pnpm@11.0.8` from the workspace root.
- A workspace checkout for developer validation commands.
- macOS for the current local package validation flow.
- `node` available on Claude's PATH if you opt into packaged Claude MCP/hooks validation from Claude itself.

## Automated validation commands

Run from the workspace root in this order:

```bash
pnpm test
pnpm check
pnpm package:desktop:dir
```

Run `pnpm package:desktop:dir` last because desktop package tests exercise the cleanup helper and may remove `apps/desktop/dist-electron`.

The package script also cleans `apps/desktop/dist-electron` before packaging to avoid stale output masking regressions.

## Package behavior notes

Phase 10C enables ASAR packaging for Electron app contents and unpacks `node_modules/**` so Claude can execute bundled MCP/hook commands as regular files with external `node`. ASAR is packaging hygiene, not a security boundary.

The builder config sets `npmRebuild: false` because the current desktop runtime dependencies are JavaScript-only. Revisit that setting if native modules are added.

The macOS package uses an OpenPets MVP `.icns` derived from the current 64×64 tray icon. It may look soft at large sizes. Higher-resolution branding and Windows/Linux icon assets remain future polish.

## Platform matrix

| Platform | Target | Status | Notes |
| --- | --- | --- | --- |
| macOS | `electron-builder --dir` unpacked app | Validate locally now | Unsigned local app may require right-click → Open outside the dev machine. |
| Windows | `electron-builder --dir` unpacked app | Unverified | Unsigned apps may trigger Defender/SmartScreen warnings; not part of this MVP closeout. |
| Linux | `electron-builder --dir` unpacked app | Unverified | Desktop integration varies by distro/window manager; not part of this MVP closeout. |

Installer targets, notarization, code signing, auto-update, and public distribution are deferred.

## macOS manual packaged-app checklist

Run this checklist after the automated commands pass.

1. Launch the generated packaged app from `apps/desktop/dist-electron/`.
   - Expected: OpenPets starts without using the dev Electron entrypoint.
2. Confirm the tray/menu bar icon appears.
   - Expected: Tray/menu items are available, including Manage Pets, Configure Agents, Settings, show/hide, pause/resume, and Quit.
3. Confirm the default pet behavior.
   - Expected: The default pet appears as an animated bundled sprite, can be shown/hidden, paused/resumed, dragged, and still behaves correctly after app restart.
   - Expected: Dragging right switches to a right-facing/running animation; dragging left switches to a left-facing/running animation; stopping settles back to idle without jitter.
4. Complete onboarding if it appears.
   - Expected: Onboarding can be completed or skipped according to the UI, and does not block using the built-in default pet.
   - To retest first-run onboarding, remove the OpenPets app data directory for your platform before launching again.
5. Open Pet Manager.
   - Expected: Installed pets and catalog state render. If the catalog is unavailable, record the catalog error and mark catalog install unverified for that run.
6. If a catalog pet is available, install it and set it as default.
   - Expected: Install succeeds, the pet can become default, and the app remains usable after restart.
   - Expected: The installed default pet shows one animated frame sequence, not the full square spritesheet, and drag left/right changes its animation direction.
   - Expected: Pet Manager keeps the current default card actionable; removable default pets can still be removed safely.
7. Open Settings, toggle a preference, quit, relaunch, and confirm persistence.
   - Expected: The changed preference persists across restart.
8. While the packaged app is running, run the local IPC smoke command from the workspace root:

   ```bash
   pnpm --filter @open-pets/client smoke:status
   ```

   - Expected: The client discovers the running packaged app and receives status without token/version errors.
9. Open Agent Setup and inspect the Claude preview without applying changes.
   - Expected: Packaged previews use `node` commands pointing inside the packaged app, not unpublished `npx -y @open-pets/*` commands.
   - Expected MCP shape: `node .../app.asar.unpacked/node_modules/@open-pets/mcp/dist/index.js`.
   - Expected hooks shape: `node .../app.asar.unpacked/node_modules/@open-pets/claude/dist/cli.js hook --openpets-managed`.
10. Optional mutating Claude validation: configure/install Claude MCP/hooks only if you intentionally want to modify your real Claude settings.
    - Expected: OpenPets shows what it will change and creates backups before editing.
    - Cleanup: use Agent Setup remove/uninstall actions when done if you do not want to keep the integration.
11. Quit OpenPets from the tray.
    - Expected: The app exits cleanly and removes transient local IPC discovery state.

## Pet and chat bubble quality checks

While OpenPets is running, trigger a speech bubble from the workspace root:

```bash
pnpm --filter @open-pets/client smoke:say "Working on it" thinking
```

Expected: the bubble is compact, readable, visually attached to the pet, and does not look like an oversized wireframe card.

Trigger a reaction:

```bash
pnpm --filter @open-pets/client smoke:react success
```

Expected: the pet remains animated and the bubble/reaction presentation stays readable and short.

## Claude packaged command notes

Packaged Claude integration uses bundled commands inside the packaged OpenPets app instead of unpublished package names.

Expected command resources live under `app.asar.unpacked`, not `app.asar`, because Claude launches them through external `node`:

```text
.../OpenPets.app/Contents/Resources/app.asar.unpacked/node_modules/@open-pets/mcp/dist/index.js
.../OpenPets.app/Contents/Resources/app.asar.unpacked/node_modules/@open-pets/claude/dist/cli.js
```

Packaged bundled Claude commands require `node` to be available on Claude's PATH.

Claude settings may contain absolute paths into the packaged OpenPets app. Moving, deleting, or replacing the app may require opening Agent Setup and using Replace/Install again. Use Agent Setup remove/uninstall before deleting the app if you want to remove OpenPets-managed Claude entries.

## Safe vs mutating validation

Safe validation:

- Running workspace tests/checks/package commands.
- Launching the packaged app.
- Inspecting Agent Setup previews.
- Running `pnpm --filter @open-pets/client smoke:status` against the local packaged app.

Mutating validation:

- Applying Claude MCP configuration.
- Installing Claude hooks.
- Removing/uninstalling Claude integration.
- Deleting OpenPets app data to retest onboarding.

Only run mutating steps intentionally. Automated tests must use temp fixtures and must not edit real Claude settings or real OpenPets user data.

## Cleanup and data-loss notes

OpenPets stores normal app state in Electron's per-user app data directory. The app logs the exact state file path on startup:

```text
OpenPets state initialized at <path>/openpets-state.json.
```

Deleting that app data directory removes installed pets, default-pet selection, onboarding completion, and preferences for that platform user.

Claude configuration is separate from OpenPets app data. Uninstalling or deleting OpenPets does not automatically remove Claude MCP entries or Claude hooks.

Package output can be removed safely:

```text
apps/desktop/dist-electron/
```

## Unsigned local-app warnings

The current package output is unsigned and not notarized.

- macOS may warn that the app is from an unidentified developer when moved to another machine.
- Windows may show Defender/SmartScreen prompts.
- Linux behavior depends on distro and desktop environment.

These warnings are expected for local MVP validation and are not acceptable for public distribution.

## Known limitations and post-MVP follow-ups

- Public distribution requires signing, notarization where applicable, installer targets, and an update strategy.
- Windows and Linux package behavior need real platform validation.
- Windows/Linux app icon assets are not configured yet.
- The current macOS app icon is MVP-quality and generated from a 64×64 source.
- Published `npx -y @open-pets/*` package flows remain future distribution work; local packaged Claude setup uses bundled app paths.
- `asarUnpack: node_modules/**` is broad for MVP reliability and can be narrowed after packaged command needs are fully characterized.
