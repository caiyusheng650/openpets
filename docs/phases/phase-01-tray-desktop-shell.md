# Phase 01: Tray-first desktop shell

## Goal

Create the first runnable OpenPets desktop app shell as a tray/menu-bar-first Electron app.

This phase should prove the desktop process, tray icon/menu, placeholder task windows, and clean quit flow work before building pet rendering or integrations.

## Non-goals

This phase does not implement:

- Floating pet windows.
- Transparent/always-on-top pet rendering.
- Pet dragging or persisted pet position.
- Real Pet Manager catalog behavior.
- Real Agent Setup detection/configuration.
- Real Settings persistence.
- Local IPC.
- MCP integration.
- Claude hooks.
- First-run onboarding.
- Production packaging/signing/notarization.

## User-visible/manual outcome

After this phase, the user/developer should be able to run the desktop app and confirm:

```text
OpenPets launches as a tray/menu-bar app, exposes the agreed tray menu, opens placeholder windows, and quits cleanly.
```

## Acceptance criteria

- Desktop app can be launched with a documented development command.
- App creates a tray/menu-bar icon.
- App does not open a dashboard/main window automatically on startup.
- Tray menu contains the agreed initial entries:

  ```text
  OpenPets
  ────────────────
  Default Pet: <name>
  Show Default Pet / Hide Default Pet
  Pause All Pets / Resume All Pets
  ────────────────
  Manage Pets...
  Configure Agents...
  Settings...
  ────────────────
  Quit OpenPets
  ```

- `OpenPets` is a disabled title row.
- `Default Pet: <name>` exists and can open the placeholder Pet Manager window.
- `Show Default Pet / Hide Default Pet` exists but may be disabled or no-op until Phase 02.
- `Pause All Pets / Resume All Pets` exists and toggles visible menu state, even if no pets exist yet.
- `Manage Pets...` opens a placeholder Pet Manager window.
- `Configure Agents...` opens a placeholder Agent Setup window.
- `Settings...` opens a placeholder Settings window.
- Placeholder windows are single-instance: choosing the same menu item focuses/reopens the existing window instead of spawning duplicates.
- Closing a placeholder window destroys only that window, clears its window reference, and does not quit the app.
- The app process is single-instance: a second launch must not create duplicate tray icons.
- `Quit OpenPets` exits the app cleanly.
- macOS behavior is handled intentionally: closing placeholder windows does not quit; explicit quit does quit.
- Basic app lifecycle errors are logged clearly during development.
- Existing Phase 00 checks continue to pass.

## Proposed files/directories

Update:

```text
apps/desktop/package.json
apps/desktop/tsconfig.json
apps/desktop/src/main.ts
README.md
```

Likely add:

```text
apps/desktop/src/tray.ts
apps/desktop/src/windows.ts
apps/desktop/src/state.ts
apps/desktop/src/lifecycle.ts
apps/desktop/src/assets.ts
```

Exact file names can change if a simpler structure is better, but Phase 01 should keep the app shell understandable.

## Technical approach

Use Electron for the desktop shell.

Recommended Phase 01 behavior:

- Add Electron as a development/runtime dependency of `apps/desktop` only.
- Add a dev command such as `pnpm --filter @open-pets/desktop dev`.
- Keep renderer placeholders minimal; do not introduce a frontend framework yet unless required.
- Use simple BrowserWindow placeholder windows with hardcoded data URLs for Phase 01.
- Keep all real product logic out of placeholders.
- Use a simple generated/nativeImage tray icon suitable for development.
- Keep all windows task-specific; do not create a dashboard.

Recommended initial desktop scripts:

```json
{
  "scripts": {
    "dev": "pnpm build && electron .",
    "check": "pnpm typecheck",
    "typecheck": "tsc --noEmit",
    "build": "tsc"
  }
}
```

Electron launch approach should be simple for Phase 01:

- Compile TypeScript to `dist/`.
- Start Electron against `dist/main.js`.
- Avoid production packager setup until Phase 10.

Because Phase 01 uses `tsc` only, avoid static asset copy complexity:

- Placeholder window HTML should be hardcoded data URLs.
- Tray icon should be generated in code through Electron/nativeImage or otherwise not require copied runtime assets.
- Do not place required runtime HTML/icons under `src/` unless the implementation also includes an explicit copy strategy.

Electron lifecycle rules:

- `app.whenReady()` creates the tray only.
- No window opens on startup.
- `window-all-closed` does not quit the app.
- macOS `activate` does not create a dashboard/main window.
- `Quit OpenPets` sets an intentional quit flag and calls `app.quit()`.
- Use `app.requestSingleInstanceLock()` so a second launch does not create duplicate tray icons.
- On second instance, keep/focus the existing app where practical and exit the second process.
- Set the app name to `OpenPets` where practical.

macOS tray/Dock decision:

- Call `app.dock.hide()` on macOS for the tray/menu-bar-first shell.
- Do not show a Dock icon in normal Phase 01 operation.
- If this causes practical development issues, document them as known limitations instead of changing the product direction silently.

Tray/menu state:

- Default pet label can use a hardcoded placeholder name such as `Default Pet: Built-in Pet` or `Default Pet: Snoopy` until real pet state exists.
- Use `Default Pet: Built-in Pet` for Phase 01.
- `Default Pet: Built-in Pet` opens the placeholder Pet Manager window.
- `Show Default Pet` is disabled until Phase 02.
- Pause state can be an in-memory boolean for now.
- Pause toggle only changes the in-memory menu label between `Pause All Pets` and `Resume All Pets`.

Placeholder windows:

- Pet Manager placeholder should make clear it is placeholder UI.
- Agent Setup placeholder should make clear it is placeholder UI.
- Settings placeholder should make clear it is placeholder UI.
- Each placeholder window should have a stable title.
- Opening a placeholder should show/restore/focus the existing window if it already exists.
- Closing a placeholder should destroy it and set its reference to `null`.

## Risks and tradeoffs

### Risk: adding frontend framework too early

Phase 01 only needs placeholder windows. Adding Vue/React/etc. now could slow the shell checkpoint.

Mitigation:

- Use minimal static placeholder UI in Phase 01.
- Decide renderer framework later when real UI work begins.

### Risk: platform tray differences

Tray/menu behavior differs between macOS, Windows, and Linux.

Mitigation:

- Implement the simplest Electron-supported tray/menu behavior first.
- Document known platform limitations from manual testing.
- Do not attempt packaging or advanced native integration in Phase 01.

### Risk: app accidentally becomes dashboard-first

Opening a main window automatically would conflict with the agreed product surface.

Mitigation:

- Do not open any main/dashboard window on startup.
- Only tray and explicitly requested task windows exist.

### Risk: app process quits unexpectedly when windows close

Electron defaults can differ by platform and window lifecycle.

Mitigation:

- Manage app quit explicitly.
- Closing placeholder task windows should not quit the app.
- `Quit OpenPets` should be the clear exit path.

### Risk: static assets fail at runtime

Running Electron from `dist/main.js` while assets live under `src/` can break if assets are not copied.

Mitigation:

- Use data URLs for placeholder HTML in Phase 01.
- Generate the development tray icon in code or use an asset strategy that does not depend on unconfigured copies.

## Security/privacy notes

This phase should not touch user agent configuration, shell profiles, Claude settings, local IPC sockets, network, pet zips, or user data beyond normal Electron app startup.

Security/privacy expectations:

- No telemetry.
- No network calls.
- No config file edits.
- No auto-start/login item changes.
- No shell command execution beyond documented development scripts.
- Placeholder windows should not enable risky web content behavior unnecessarily.

Required BrowserWindow safety defaults for placeholders:

- `nodeIntegration: false`.
- `contextIsolation: true`.
- `sandbox: true`.
- No preload script unless absolutely needed. Phase 01 should not need one.
- No remote content loaded.
- Deny navigation away from the placeholder content.
- Deny new-window creation.
- If using data URLs, all content must be hardcoded and no user data should be interpolated.

Placeholder HTML should include a restrictive content security policy where practical.

## Test/check plan

Automated checks:

```bash
pnpm check
pnpm typecheck
pnpm build
```

Manual app run command should be documented after implementation, likely:

```bash
pnpm --filter @open-pets/desktop dev
```

Expected automated result:

- TypeScript checks pass.
- Desktop app build passes.
- Existing workspace package checks continue to pass.

## Manual verification guide

After implementation, the user should verify:

1. Start the desktop app with the documented command.
2. Confirm no dashboard/main window opens automatically.
3. Confirm OpenPets appears in the tray/menu bar.
4. Open the tray menu and verify entries match the Phase 01 menu.
5. Click `Manage Pets...` and confirm one placeholder Pet Manager window opens.
6. Click `Manage Pets...` again and confirm it focuses/reuses the existing window instead of spawning duplicates.
7. Repeat for `Configure Agents...`.
8. Repeat for `Settings...`.
9. Toggle `Pause All Pets` and confirm the menu changes to `Resume All Pets`.
10. Close placeholder windows and confirm the app stays running in tray/menu bar.
11. Choose `Quit OpenPets` and confirm the app exits cleanly.

Manual acceptance question:

```text
Does Phase 01 pass on your machine: tray app launches, menu matches, placeholder windows work, and quit is clean?
```

## Oracle plan review

Oracle reviewed the initial Phase 01 spec and blocked implementation until the spec was tightened.

Summary of required Oracle feedback:

- Define Electron lifecycle behavior explicitly.
- Add app-level single-instance behavior.
- Specify asset strategy so `tsc` builds do not break runtime HTML/icons.
- Make BrowserWindow security defaults mandatory.
- Choose placeholder window close semantics.
- Choose menu placeholder states.
- Specify exact desktop scripts.
- Add macOS tray/Dock behavior.

## Oracle feedback disposition

- Fixed: Added explicit Electron lifecycle rules.
- Fixed: Added `app.requestSingleInstanceLock()` requirement.
- Fixed: Chose data URLs/generated icon strategy to avoid asset-copy issues in Phase 01.
- Fixed: Made BrowserWindow security defaults mandatory.
- Fixed: Chose destroy-on-close semantics for placeholder windows.
- Fixed: Chose `Default Pet: Built-in Pet`, disabled `Show Default Pet`, and in-memory pause-label toggle for Phase 01.
- Fixed: Added exact `dev` script shape: `pnpm build && electron .`.
- Fixed: Added macOS `app.dock.hide()` decision.

## Oracle implementation review

Oracle reviewed the implemented Phase 01 diff after successful validation with:

```bash
pnpm check && pnpm typecheck && pnpm build && pnpm --filter @open-pets/desktop exec electron --version
```

Initial implementation review blocked manual verification until two issues were fixed:

- Tray icon used an SVG data URL that may not be consistently supported by Electron tray icons.
- Placeholder `window.loadURL(...)` rejection was not handled explicitly.

Implementation review disposition:

- Fixed: Replaced SVG tray icon with generated raw bitmap data through `nativeImage.createFromBitmap(...)`.
- Fixed: Added `image.isEmpty()` logging for tray icon creation failures.
- Fixed: Added explicit `loadURL(...).catch(...)` logging.
- Fixed: Attached `ready-to-show` before `loadURL(...)`.
- Fixed: Added `render-process-gone` logging.
- Fixed: Hardened placeholder CSP with `base-uri 'none'`, `form-action 'none'`, and `frame-src 'none'`.
- Fixed: Updated README wording for `apps/desktop`.

Oracle re-reviewed the fixes and approved Phase 01 for manual user verification.
