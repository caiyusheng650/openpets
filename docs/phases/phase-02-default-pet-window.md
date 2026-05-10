# Phase 02: Default pet window foundation

## Goal

Show the bundled default pet as a real floating desktop companion window.

This phase should prove the core visible OpenPets experience: a small pet appears, can be dragged, can be shown/hidden from the tray, can be paused/resumed, and remembers its position across app restarts.

## Non-goals

This phase does not implement:

- Pet catalog browsing or installation.
- Multiple installed pets.
- Non-default temporary agent pets.
- MCP leases.
- Local IPC.
- Claude integration.
- Speech bubbles.
- Complex physics.
- Advanced desktop-edge/running behavior.
- Complex multi-monitor behavior beyond safe positioning.
- First-run onboarding.
- Production packaging.

## User-visible/manual outcome

After this phase, the user/developer should be able to run the desktop app and confirm:

```text
The bundled default pet appears as a small floating window, can be dragged, can be hidden/shown from the tray, pause/resume visibly affects it, and its position persists across restarts.
```

## Acceptance criteria

- Desktop app still launches tray-first.
- Bundled default pet appears automatically on app launch.
- Pet window is frameless.
- Pet window has transparent background where supported by the platform.
- Pet window is always-on-top by default.
- Pet window does not steal focus from the active editor/terminal where supported.
- Pet window is draggable by the user.
- Pet window remembers its last position across app restarts.
- Initial default position is near the bottom-right of the primary display work area.
- Initial position is clamped to the visible work area.
- Stored position is clamped if it is no longer visible/safe.
- `Show Default Pet` / `Hide Default Pet` tray item works for the persistent default pet.
- `Pause All Pets` / `Resume All Pets` visibly affects the pet.
- Closing placeholder task windows does not close the pet or quit the app.
- Quitting OpenPets closes the pet window cleanly.
- Phase 01 placeholder windows and tray behavior continue to work.
- Known platform limitations are documented after manual testing.
- Hidden state is session-only in Phase 02: every fresh app launch shows the default pet.
- Display changes while running re-clamp the pet to a visible work area.

## Proposed files/directories

Likely update:

```text
apps/desktop/package.json
apps/desktop/src/main.ts
apps/desktop/src/tray.ts
apps/desktop/src/state.ts
apps/desktop/src/windows.ts
README.md
```

Likely add:

```text
apps/desktop/src/pet-window.ts
apps/desktop/src/pet-state.ts
apps/desktop/src/default-pet-controller.ts
apps/desktop/src/display.ts
```

Exact file names can change if a simpler structure is better.

## Technical approach

Keep this phase intentionally simple and stable.

### Pet rendering

Use a minimal bundled default pet renderer for Phase 02.

Recommended approach:

- Render a small hardcoded pet placeholder using inline generated HTML/CSS/SVG or canvas from TypeScript.
- Avoid adding a real spritesheet animation system until the pet format/catalog phases unless it is simpler to reuse a safe bundled asset.
- The pet should visibly look like a pet/companion, not a blank test square.
- Pause/resume should visibly change the pet state, for example normal idle animation vs still/dimmed/paused label.
- Do not put required runtime pet assets under `src/` unless an explicit copy strategy is added.
- Prefer inline generated content for Phase 02 so plain `tsc` builds remain sufficient.

This phase is about window behavior, not final pet art or animation fidelity.

### Pet window behavior

Use a dedicated `BrowserWindow` for the default pet.

Use fixed Phase 02 window bounds:

```text
width: 180 DIP
height: 180 DIP
margin from work area: 24 DIP
```

The window should be tight around the visible pet to avoid a large transparent click-blocking overlay.

Recommended BrowserWindow properties:

- `frame: false`
- `transparent: true`
- `resizable: false`
- `skipTaskbar: true`
- `alwaysOnTop: true`
- secure `webPreferences` similar to Phase 01 placeholders

Use conservative always-on-top behavior. Do not use aggressive screen-saver/topmost hacks in Phase 02.

Focus behavior:

- When showing the pet automatically or from tray, use `showInactive()` where practical so the pet does not steal focus from the active editor/terminal.
- Clicking or dragging the pet may focus the pet window on some platforms; this is best-effort and should be documented after manual testing.
- Do not use fragile native hacks in Phase 02.
- If perfect no-focus behavior is not possible on a platform, document it as a known limitation.

Dragging:

- The user should be able to drag the pet window.
- Preferred implementation: CSS `-webkit-app-region: drag` for the pet surface so no IPC/preload is needed.
- If CSS app-region cannot satisfy the behavior, use a narrow preload bridge only for drag movement.
- Do not introduce broad renderer privileges for dragging.

Pause/resume renderer updates:

- Preferred implementation: reload/regenerate the local pet HTML with the paused state.
- Alternative: use a narrow preload bridge only if needed.
- Do not use a broad `executeJavaScript` control channel.

### Default pet ownership model

Add a small default-pet controller/module to own default pet lifecycle.

The tray should not directly manage pet window internals.

Recommended controller API shape:

```ts
showDefaultPet(): void
hideDefaultPet(): void
isDefaultPetVisible(): boolean
setDefaultPetPaused(paused: boolean): void
destroyDefaultPet(): void
```

Responsibilities:

- Create the pet window on app launch.
- Show/hide default pet.
- Track visible state for the current app session.
- Apply paused state to the renderer.
- Persist and restore position.
- Destroy the pet window on app quit.

Hidden state rule:

- `Hide Default Pet` hides the window but does not destroy it.
- Hidden state is session-only in Phase 02.
- On fresh app launch, the default pet appears automatically again.
- Position persists; hidden/visible preference does not persist yet.

### Persistence

Persist only the minimum state needed for Phase 02:

- Default pet position.
- Paused state may remain in-memory for this phase unless persistence is trivial.

Use Electron `app.getPath("userData")` for local app state.

Recommended state file:

```text
<userData>/openpets-state.json
```

State writes should be simple and safe:

- JSON file.
- Atomic write where practical: write temp file then rename.
- Validate/read defensively.
- Ignore corrupted state with a dev log and fall back to defaults.

### Safe positioning

Use the primary display work area for Phase 02.

Rules:

- Position values use Electron DIP coordinates.
- Store integer `x` and `y` values for the full pet window bounds.
- Initial position: bottom-right of primary display work area with 24 DIP margin.
- Stored position: clamp to visible work area on launch.
- Clamp the full 180x180 DIP window so it remains fully visible.
- Do not attempt advanced multi-monitor restoration yet.
- If displays change, keep the pet visible rather than preserving exact off-screen coordinates.
- Listen for display changes where practical and re-clamp the default pet to the primary work area.

### Tray integration

Update the Phase 01 tray item:

- If default pet visible: show `Hide Default Pet`.
- If default pet hidden: show `Show Default Pet`.
- Clicking toggles the default pet window.
- `Pause All Pets` / `Resume All Pets` updates the pet visual state.

Default pet lifetime:

- Default pet is persistent.
- It is not closed due to agent lifecycle in future phases.
- In this phase, hiding does not destroy the pet window.
- The pet window is destroyed only when OpenPets quits.

## Risks and tradeoffs

### Risk: no-focus behavior differs by platform

Electron focus behavior varies by macOS/Windows/Linux.

Mitigation:

- Use documented Electron APIs only.
- Prefer stable behavior over hacks.
- Document platform limitations after manual testing.

### Risk: transparent windows behave differently by platform

Transparent frameless windows can vary on Linux/window managers.

Mitigation:

- Implement best-effort Electron transparent window behavior.
- Keep fallback acceptable: pet remains visible even if transparency is imperfect.
- Document limitations.

### Risk: dragging requires IPC/preload before local IPC phase

Dragging may require communication between renderer and main process, but Phase 05 local IPC is a separate adapter/app control plane.

Mitigation:

- If needed, use a very narrow Electron preload bridge only for pet window dragging.
- Do not implement external/local OpenPets IPC in this phase.
- Keep the bridge private to the pet renderer.

### Risk: state file corruption

Simple JSON state can be corrupted by interrupted writes or manual edits.

Mitigation:

- Read defensively.
- Validate shape.
- Atomic write where practical.
- Fall back to defaults without crashing.

### Risk: scope creep into pet engine

It is tempting to build the final sprite/animation system now.

Mitigation:

- Keep rendering minimal.
- Build only enough to verify floating pet behavior.
- Defer final manifest/spritesheet rendering to catalog/pet-format phases.

### Risk: pet window blocks clicks over transparent areas

Transparent BrowserWindows still have rectangular bounds and may intercept clicks.

Mitigation:

- Keep the Phase 02 pet window small and tight around the pet.
- Do not create a large transparent overlay.
- Defer click-through/advanced hit-testing behavior unless it becomes necessary.

## Security/privacy notes

This phase should not touch coding-agent configs, Claude settings, MCP, local adapter IPC, network, or pet zip extraction.

Security/privacy expectations:

- No telemetry.
- No network calls.
- No remote content loaded in pet window.
- No config file edits outside OpenPets own userData state file.
- No shell command execution.
- Pet renderer uses hardcoded local content only.
- Pet renderer includes a restrictive CSP.
- Pet renderer denies navigation, redirects, and new windows.
- Pet renderer logs load failures and renderer crashes clearly during development.
- BrowserWindow security defaults are mandatory:
  - `nodeIntegration: false`
  - `contextIsolation: true`
  - `sandbox: true` where compatible with required drag behavior
  - no remote content
  - deny navigation/new windows

If a preload bridge is needed for dragging, it must expose only minimal drag APIs and no general Node/Electron access.

## Test/check plan

Automated checks:

```bash
pnpm check
pnpm typecheck
pnpm build
```

Manual app run command:

```bash
pnpm --filter @open-pets/desktop dev
```

Expected automated result:

- TypeScript checks pass.
- Desktop app build passes.
- Existing workspace package checks continue to pass.

## Manual verification guide

After implementation, the user should verify:

1. Start the desktop app:

   ```bash
   pnpm --filter @open-pets/desktop dev
   ```

2. Confirm no dashboard/main window opens automatically.
3. Confirm tray icon/menu still appears.
4. Confirm the default pet appears automatically.
5. Confirm the pet is a small frameless floating window.
6. Confirm the pet stays above normal windows where supported.
7. Confirm clicking/dragging the pet does not unexpectedly steal focus from the active app where supported.
8. Drag the pet to a new position.
9. Quit OpenPets from the tray.
10. Restart OpenPets and confirm the pet position persists.
11. Use tray `Hide Default Pet` and confirm the pet hides without quitting the app.
12. Use tray `Show Default Pet` and confirm the same default pet returns.
13. Hide the pet, quit OpenPets, restart OpenPets, and confirm the pet appears again because hidden state is not persisted in Phase 02.
14. Toggle `Pause All Pets` and confirm the pet visibly changes to paused/quiet state.
15. Toggle `Resume All Pets` and confirm the pet returns to normal state.
16. Open/close placeholder Pet Manager, Configure Agents, and Settings windows and confirm the pet remains alive.
17. If practical, move/change displays and confirm the pet remains visible or is re-clamped on restart.
18. Quit OpenPets and confirm all windows close cleanly.

Manual acceptance question:

```text
Does Phase 02 pass on your machine: default pet appears, can be dragged, persists position, show/hide works, pause/resume is visible, and quit is clean?
```

## Oracle plan review

Oracle reviewed the initial Phase 02 spec and blocked implementation until lifecycle, visibility, asset, focus/drag, controller, and security details were tightened.

Summary of required Oracle feedback:

- Clarify default pet launch visibility and hidden-state persistence.
- Clarify hide vs destroy behavior.
- Add a default-pet controller ownership model instead of tray owning lifecycle.
- Replace required `src/assets/default-pet.svg` asset idea with inline generated content or explicit copy strategy.
- Define fixed window size and clamping rules.
- Define focus behavior precisely, especially `showInactive()` and click/drag limitations.
- Choose drag strategy order.
- Define pause/resume renderer update mechanism.
- Add pet-window security hardening details.
- Add manual verification for hidden/restart and display re-clamping behavior.

## Oracle feedback disposition

- Fixed: Default pet appears on every fresh launch; hidden state is session-only in Phase 02.
- Fixed: `Hide Default Pet` hides but does not destroy the pet window; destroy happens on app quit.
- Fixed: Added default-pet controller ownership model and API shape.
- Fixed: Replaced runtime asset recommendation with inline generated pet HTML/CSS/SVG/canvas.
- Fixed: Added fixed 180x180 DIP window size, 24 DIP margin, integer DIP coordinates, and full-window clamping rules.
- Fixed: Clarified `showInactive()` focus behavior and click/drag best-effort limitations.
- Fixed: Chose CSS `-webkit-app-region: drag` first; narrow preload bridge only if necessary.
- Fixed: Chose reload/regenerate local pet HTML for pause/resume first; narrow preload only if necessary.
- Fixed: Added CSP/navigation/new-window/load-failure/render-crash security requirements for pet renderer.
- Fixed: Added manual verification for hidden/restart behavior and display re-clamping.

## Oracle implementation review

Oracle reviewed the implemented Phase 02 diff after successful validation with:

```bash
pnpm check && pnpm typecheck && pnpm build
```

Initial implementation review blocked manual verification until two issues were fixed:

- The initial tray menu label could be stale because the tray was created before the default pet was shown.
- A pending debounced position save could read from a destroyed pet window if the user dragged and quit quickly.

Implementation review disposition:

- Fixed: Exported `refreshTrayMenu()` and called it after `showDefaultPet()` on startup so the tray label reflects the visible pet.
- Fixed: Guarded the debounced position save with `window.isDestroyed()` before reading window position.

Oracle re-reviewed the fixes and approved Phase 02 for manual user verification.
