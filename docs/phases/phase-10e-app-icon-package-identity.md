# Phase 10E: App Icon Package Identity

## Goal

Replace the default Electron packaged-app icon with OpenPets-owned package icon assets while keeping tray icon behavior unchanged.

This phase removes the remaining default-icon packaging warning for the current macOS package and documents Windows/Linux icon follow-up if needed.

## Non-goals

- No signing/notarization.
- No installer targets beyond `--dir`.
- No visual redesign of the app UI.
- No new marketing/brand system.
- No replacing the small tray icon unless packaging requires shared source art.

## User-visible/manual outcome

The packaged app no longer uses Electron's default app icon. On macOS package output, `OpenPets.app` has an OpenPets MVP app icon. If generated from the current 64×64 source, the icon is temporary and may look soft at large sizes.

## Acceptance criteria

- A package app icon asset exists under desktop assets/build resources.
- `electron-builder` config points at the app icon.
- macOS `pnpm package:desktop:dir` no longer emits the default Electron icon warning, or the warning remains explicitly documented if generated icon quality is rejected.
- The tray icon remains loaded from `assets/tray-icon.png` and still renders in the tray.
- Package contract checks assert app icon assets/config exist.
- Package contract checks assert tray icon code/config still points at `assets/tray-icon.png`.
- Icon generation must not leave temporary `icon.iconset/` directories in the repository.
- `docs/mvp-validation.md` updates the default-icon note.
- `pnpm test` passes.
- `pnpm check` passes.
- `pnpm package:desktop:dir` passes.

## Proposed files/directories

- `apps/desktop/assets/app-icon.icns`
  - macOS app icon generated from OpenPets-owned source art.
- `apps/desktop/electron-builder.yml`
  - Add macOS icon config.
- `apps/desktop/src/check-packaging-contract.ts`
  - Assert icon config and asset exist.
- `docs/mvp-validation.md`
  - Update icon warning notes.
- `docs/phases/phase-10e-app-icon-package-identity.md`

## Technical approach

Use the existing `assets/tray-icon.png` as the source for a simple MVP app icon if it produces acceptable results. The current PNG is 64×64, so generated `.icns` will be basic and can be visually improved later with higher-resolution brand artwork.

Generate `.icns` on macOS using built-in tools if available, using a temporary directory outside the repo or cleaning it before completion:

```bash
mkdir -p icon.iconset
sips -z ...
iconutil -c icns icon.iconset
```

If high-quality `.icns` generation is not reliable from the 64×64 source, do not fake a polished icon. Either commit an MVP/temporary `.icns` and document soft quality, or document the asset limitation and defer high-resolution icon work.

Configure electron-builder:

```yaml
mac:
  icon: assets/app-icon.icns
```

Keep Windows/Linux icons deferred unless existing tooling can produce `.ico`/PNG assets safely without extra dependencies.

## Risks and tradeoffs

- Source tray icon is only 64×64, so the app icon may look soft at large sizes.
- `.icns` generation is macOS-specific; acceptable because current packaging validation is on macOS.
- Windows/Linux icon polish may need separate assets and should be deferred unless trivial.

## Security/privacy notes

- Icon generation must use repository assets only.
- No user data or config is touched.

## Test/check plan

Run:

```bash
pnpm test
pnpm check
pnpm package:desktop:dir
```

Check package output logs for default Electron icon warning absence.
If practical, inspect the generated `.icns` with `iconutil -c iconset` or `file`.

## Manual verification guide

Manual verification is provided after implementation and should include checking the packaged `.app` Finder/Dock icon and confirming the tray icon still appears.

## Oracle plan review

Reviewed by Oracle.

Blockers: none.

Should-fix feedback:

- Do not describe an upscaled 64×64 `.icns` as polished; acceptance should allow MVP/temporary quality or deferral if bad.
- Add contract checks for `assets/app-icon.icns`, `mac.icon`, and tray icon still using `assets/tray-icon.png`.
- Add manual verification for packaged Finder/Dock icon and tray icon.
- Ensure temporary `icon.iconset/` is not left in repo.

Nice-to-have feedback:

- Build-resource directory may be better later; `assets/app-icon.icns` is acceptable now.
- Document Windows/Linux icon assets as future work.
- Inspect `.icns` with `iconutil` or `file` if feasible.

Verdict: implementation-ready; frame as MVP identity cleanup, not final branding.

## Oracle feedback disposition

Fixed:

- Spec now frames generated 64×64-derived icon as MVP/temporary and allows deferral if quality is unacceptable.
- Added contract check requirements for app icon, mac icon config, and unchanged tray icon path.
- Added manual verification requirements for packaged app icon and tray icon.
- Added temporary iconset cleanup requirement.
- Added optional `.icns` inspection note.

Accepted:

- Windows/Linux icon assets are future work, not Phase 10E failure.

## Oracle implementation review

Reviewed by Oracle after implementation.

Blockers: none.

Should-fix: none.

Nice-to-have feedback:

- Contract checks could eventually inspect packaged `.app` icon metadata; current `electron-builder` success and warning disappearance are enough for MVP.
- Future branding should replace the upscaled 64×64-derived `.icns` with high-resolution source art.

Verdict: implementation is acceptable. Asset/config/checks/docs align with MVP package identity scope, tray behavior is guarded, and remaining signing/platform icon work is correctly deferred.

## Oracle implementation feedback disposition

Accepted:

- Packaged `.app` metadata inspection remains future hardening.
- High-resolution branding remains future polish.
