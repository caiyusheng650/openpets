# Phase 03: Local state and Pet Manager basics

## Goal

Turn the current desktop shell into a minimally real local-first app by formalizing app state and making Pet Manager / Settings show and update the built-in default pet behavior.

This phase should prove that OpenPets owns local preferences and installed-pet state before remote catalog installation, MCP, or Claude integration are added.

## Non-goals

This phase does not implement:

- Remote v2 pet catalog fetching.
- Downloading or installing pet zip files.
- Removing downloaded pets.
- Multiple real pet assets beyond the bundled built-in pet.
- Full pet manifest/spritesheet engine.
- Agent setup detection/configuration.
- Local adapter IPC.
- MCP integration.
- Claude hooks.
- Speech bubbles.
- First-run onboarding.
- Production packaging.

## User-visible/manual outcome

After this phase, the user/developer should be able to run the app and confirm:

```text
Pet Manager shows the bundled built-in pet as installed/default/protected, Settings controls core local preferences, and those preferences persist across restarts.
```

## Acceptance criteria

- Existing tray shell and default pet window behavior continue to work.
- App state has a clear versioned schema.
- State is loaded after `app.whenReady()` and not at module import time.
- State remains local-only under Electron `app.getPath("userData")`.
- State reads are defensive and corrupted/invalid state falls back safely.
- State writes are atomic where practical.
- `app-state.ts` is the only owner/writer of `openpets-state.json`.
- Phase 02 `pet-state.ts` is retired or delegates to `app-state.ts` so pet position writes cannot clobber preferences/pets.
- Existing unversioned Phase 02 state is migrated to V1 while preserving default pet position.
- Built-in pet exists in app state as an installed/protected pet.
- Built-in pet cannot be removed.
- Built-in pet is the default pet unless the state says otherwise.
- Pet Manager is upgraded from placeholder to a minimal real local view.
- Pet Manager shows installed pets, including the built-in pet.
- Pet Manager shows badges/states for `Built-in`, `Installed`, `Default`, and `Protected` where applicable.
- Pet Manager shows that built-in pet removal is unavailable/disabled.
- Pet Manager can set an installed pet as default; in Phase 03 this may be a no-op if only the built-in pet exists, but the UI/state path should be real.
- Settings is upgraded from placeholder to a minimal real preferences view.
- Settings can control `open default pet on app launch`.
- Settings can control `speech bubbles enabled`, even though speech bubbles are not implemented yet.
- `petScale` may exist as inert schema state with default `1`, but visible pet scale controls are deferred to a later phase.
- Settings can reset the default pet position.
- Preferences persist across app restarts.
- If `open default pet on app launch` is disabled, app starts tray-first without showing the default pet.
- `Show Default Pet` can still show the default pet manually when launch-open is disabled.
- If `open default pet on app launch` is re-enabled, the pet appears on future launches.
- Phase 02 hidden-state rule remains: hiding from tray is session-only and is not the same as disabling open-on-launch.
- Automated checks pass.

## Proposed files/directories

Likely update:

```text
apps/desktop/src/main.ts
apps/desktop/src/tray.ts
apps/desktop/src/windows.ts
apps/desktop/src/default-pet-controller.ts
apps/desktop/src/pet-state.ts
apps/desktop/src/pet-window.ts
README.md
```

Likely add:

```text
apps/desktop/src/app-state.ts
apps/desktop/src/built-in-pet.ts
apps/desktop/src/settings-controller.ts
apps/desktop/src/pet-manager-controller.ts
apps/desktop/src/renderer-html.ts
apps/desktop/src/preload.ts            # only if needed for safe internal Electron UI actions
```

Exact file names can change if a simpler structure is better.

## Technical approach

Keep Phase 03 local and minimal. This is not the catalog phase and not a full UI framework phase.

### App state model

Formalize a versioned local app state file.

Recommended state path:

```text
<userData>/openpets-state.json
```

Recommended state shape:

```ts
interface OpenPetsStateV1 {
  version: 1;
  preferences: {
    defaultPetId: string;
    openDefaultPetOnLaunch: boolean;
    speechBubblesEnabled: boolean;
    petScale: number;
  };
  pets: {
    installed: Array<{
      id: string;
      displayName: string;
      builtIn: boolean;
      protected: boolean;
    }>;
  };
  defaultPet: {
    position?: {
      x: number;
      y: number;
    };
  };
}
```

Default state:

- `defaultPetId`: built-in pet id.
- `openDefaultPetOnLaunch`: `true`.
- `speechBubblesEnabled`: `true`.
- `petScale`: `1`.
- Installed pets contains the built-in pet.

State rules:

- Built-in pet is always present, even if an old/corrupt state omits it.
- Default pet falls back to built-in pet if missing/invalid.
- Canonical built-in pet metadata wins over state file metadata.
- Protected/built-in flags cannot be disabled by a user-edited/corrupt state file.
- `petScale` remains `1` in Phase 03 unless later implemented.
- Position should continue to use safe Phase 02 clamping rules.
- State-derived strings must be treated as untrusted and escaped before rendering.

### State ownership

Move Phase 02 position persistence into the broader app state module as a required part of this phase.

Avoid split-brain state where different modules write unrelated JSON shapes to the same file.

Recommended ownership:

- `app-state.ts` owns reading/writing `openpets-state.json`.
- Controllers request state updates through narrow functions.
- State is loaded only after `app.whenReady()`.
- No app state reads happen at module import time.
- `pet-state.ts` should be removed or changed to delegate to `app-state.ts`.
- No module other than `app-state.ts` writes directly to `openpets-state.json`.
- All state updates are read/modify/write against one in-memory normalized state object.
- State updates should be serialized in-process to avoid debounced pet-position saves clobbering Settings updates.

Recommended `app-state.ts` API shape:

```ts
initializeAppState(): void
getAppStateSnapshot(): OpenPetsStateV1
updatePreferences(patch: Partial<OpenPetsStateV1["preferences"]>): OpenPetsStateV1
setDefaultPet(defaultPetId: string): OpenPetsStateV1
setDefaultPetPosition(position: { x: number; y: number }): OpenPetsStateV1
resetDefaultPetPosition(): OpenPetsStateV1
```

The API can differ if implementation finds a simpler shape, but the ownership rules must remain.

Startup ordering:

1. `app.whenReady()` resolves.
2. `app.setName("OpenPets")` runs.
3. App state is loaded/normalized through `initializeAppState()`.
4. Tray is created.
5. Display/lifecycle handlers are installed.
6. Default pet is shown only if `openDefaultPetOnLaunch` is true.
7. Tray menu is refreshed so labels match actual pet visibility.

Migration rule:

- Phase 02 already wrote unversioned state shaped like `{ defaultPet: { position } }`.
- Phase 03 must read that V0/unversioned shape and migrate it to V1.
- The migrated V1 state must preserve valid `defaultPet.position`.
- Unknown/corrupt state should not crash the app.

### Built-in pet model

Define one bundled built-in pet record in code.

Recommended values:

```ts
id: "builtin"
displayName: "Built-in Pet"
builtIn: true
protected: true
```

This is a local app-state pet record, not the final downloadable pet manifest contract.

### Pet Manager basics

Upgrade the Pet Manager placeholder into a minimal real local view.

Recommended UI content:

- Title: `Pet Manager`.
- Installed pets section.
- Built-in pet card/row.
- Badges: `Built-in`, `Installed`, `Default`, `Protected`.
- Disabled remove action for built-in pet.
- `Set Default` action for installed pets that are not default.
- Empty/loading/catalog messaging should clearly say catalog browsing arrives in a later phase.

Phase 03 does not need a polished catalog grid. It only needs to prove local installed/default state.

### Settings basics

Upgrade the Settings placeholder into a minimal real preferences view.

Initial settings:

- `Open default pet on app launch` toggle.
- `Speech bubbles enabled` toggle.
- `Pet scale` visible disabled/deferred row or omitted from UI; do not implement scaling controls in Phase 03.
- `Reset default pet position` button.

Settings behavior:

- Changes persist to local state.
- Toggling `Open default pet on app launch` affects next app launch, not necessarily the current pet visibility.
- Reset position should move the visible default pet back to bottom-right immediately if visible and update persisted state.
- If the pet is hidden, reset position updates persisted state; the next show/restart uses the reset position.
- If the pet window has not been created because `openDefaultPetOnLaunch` is disabled, reset position updates persisted state only.
- Speech setting persists but has no visible speech behavior yet.

### Internal renderer interaction

If Pet Manager/Settings need clickable controls, use safe internal Electron IPC/preload only for those task windows.

Important distinction:

- This is Electron renderer-to-main IPC for app UI.
- This is not the Phase 05 local adapter IPC protocol for MCP/CLI/Claude packages.

Required preload/security behavior if used:

- `contextIsolation: true`.
- `nodeIntegration: false`.
- `sandbox: true` where compatible.
- Preload exposes only narrow methods needed for Phase 03 UI actions.
- No generic filesystem, shell, or Electron object exposure.
- Validate all action names/payloads in main process.
- Validate sender `webContents` belongs to an allowed internal task window.

Recommended preload/API contract:

```ts
window.openPets.getState(): Promise<OpenPetsStateV1>
window.openPets.updatePreferences(patch: {
  openDefaultPetOnLaunch?: boolean;
  speechBubblesEnabled?: boolean;
}): Promise<OpenPetsStateV1>
window.openPets.setDefaultPet(petId: string): Promise<OpenPetsStateV1>
window.openPets.resetDefaultPetPosition(): Promise<OpenPetsStateV1>
```

Rules:

- Do not expose a generic `invoke(action, payload)` API.
- Do not expose filesystem/shell/Electron access.
- Validate booleans as booleans.
- Validate `petId` as a known installed pet id before setting default.
- Validate that reset-position requests come from Settings.
- Renderer should query latest state when opened/focused and after mutations.
- Avoid `webContents.executeJavaScript` as a state/control channel.

If a simpler approach can keep views read-only and use tray/menu actions for state changes, that is acceptable only if acceptance criteria remain met. Since Settings needs toggles/buttons, a narrow preload bridge is likely appropriate.

### Window/rendering approach

Do not introduce React/Vue/Vite yet.

Use generated local HTML for Pet Manager and Settings, similar to prior phases, unless implementation complexity becomes unreasonable.

Renderer content should:

- Be local/hardcoded.
- Include restrictive CSP.
- Deny navigation/new windows.
- Log load/render failures.
- Escape all state-derived strings before insertion into HTML.

## Risks and tradeoffs

### Risk: state shape churn

Early state schemas can become hard to migrate later.

Mitigation:

- Add `version: 1` now.
- Keep schema minimal.
- Validate defensively.
- Normalize state on read to ensure built-in/default invariants.

### Risk: overbuilding UI before real catalog

Pet Manager could become a dashboard or fake catalog.

Mitigation:

- Only show installed local pets in Phase 03.
- Clearly label catalog browsing as a later phase.
- Do not add search/categories/catalog fetch yet.

### Risk: internal IPC scope creep

Adding preload/UI IPC could become too broad.

Mitigation:

- Expose only Phase 03 actions.
- Validate payloads.
- Validate sender window/webContents.
- Do not expose filesystem/shell/Electron.
- Keep this separate from the future local adapter IPC.

### Risk: position state regression

Moving Phase 02 position persistence into app state could break drag/restart behavior.

Mitigation:

- Preserve Phase 02 manual verification.
- Keep position clamping and atomic writes.
- Re-run drag/restart verification.

## Security/privacy notes

This phase remains local-only.

Security/privacy expectations:

- No telemetry.
- No network calls.
- No remote content.
- No coding-agent config edits.
- No shell command execution.
- No pet zip extraction.
- App writes only its own local state file under `app.getPath("userData")`.
- Renderer IPC, if used, is narrow and validated.
- Built-in pet cannot be removed through UI or state corruption.
- State files are treated as untrusted input.
- State-derived renderer content is escaped.

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

2. Confirm tray and default pet still appear.
3. Open `Manage Pets...`.
4. Confirm the built-in pet is shown as installed/default/protected.
5. Confirm built-in pet cannot be removed.
6. Confirm setting built-in pet as default is disabled/no-op because it is already default.
7. Open `Settings...`.
8. Toggle `Speech bubbles enabled`, quit, restart, and confirm the setting persisted.
9. Toggle `Open default pet on app launch` off, quit, restart, and confirm the default pet does not appear automatically.
10. Use tray `Show Default Pet` and confirm the default pet can still be shown manually.
11. Toggle `Open default pet on app launch` back on, quit, restart, and confirm the default pet appears automatically again.
12. Drag the pet to a new position, quit, restart, and confirm position still persists.
13. Use `Reset default pet position` and confirm the pet moves back near bottom-right and persists there after restart.
14. If a Phase 02 unversioned state file exists, confirm position is preserved after Phase 03 migration.
15. If practical, temporarily corrupt `openpets-state.json`, restart, and confirm app falls back safely with built-in pet/default preferences.
16. Confirm placeholder/real task windows still do not quit the app when closed.
17. Quit OpenPets and confirm clean exit.

Manual acceptance question:

```text
Does Phase 03 pass on your machine: Pet Manager shows built-in pet state, Settings preferences persist, open-on-launch works, reset position works, and Phase 02 pet behavior still works?
```

## Oracle plan review

Oracle reviewed the initial Phase 03 spec and blocked implementation until state ownership/migration and internal preload/IPC details were tightened.

Summary of required Oracle feedback:

- Make Phase 02 state migration mandatory.
- Retire or delegate `pet-state.ts` so there is one state-file writer.
- Add V0/unversioned state migration preserving position.
- Define startup ordering and open-on-launch gating.
- Define app-state API and whole-state write semantics.
- Define preload/API contract and validation rules.
- Require escaping state-derived renderer content.
- Require windows to render/query latest state after mutations.
- Defer visible pet scale controls.
- Define reset-position behavior for visible, hidden, and not-created pet states.
- Add manual verification for corrupted state and V0 migration.

## Oracle feedback disposition

- Fixed: Made Phase 02 position migration into `app-state.ts` mandatory.
- Fixed: Required `app-state.ts` to be the only owner/writer of `openpets-state.json`.
- Fixed: Added V0/unversioned migration preserving `defaultPet.position`.
- Fixed: Added startup ordering with `initializeAppState()` before tray/show-default-pet logic.
- Fixed: Added recommended app-state API and whole-state update semantics.
- Fixed: Added concrete preload/API contract and validation rules.
- Fixed: Required sender validation for internal renderer IPC.
- Fixed: Required escaping all state-derived renderer content.
- Fixed: Required renderer state refresh after mutations.
- Fixed: Deferred visible pet scale controls; `petScale` remains inert default state only.
- Fixed: Defined reset-position behavior for visible, hidden, and not-yet-created pet states.
- Fixed: Added manual verification for V0 migration and corrupt-state fallback.

## Oracle implementation review

Oracle reviewed the implemented Phase 03 diff after successful validation with:

```bash
pnpm check && pnpm typecheck && pnpm build
```

Oracle found no blocking correctness, security, state migration, or scope issues and approved Phase 03 for manual user verification.

Implementation review disposition:

- Approved: Versioned app state and V0 migration preserve Phase 02 pet position.
- Approved: `pet-state.ts` was removed and `app-state.ts` owns `openpets-state.json`.
- Approved: Open-on-launch gating and reset-position behavior are implemented.
- Approved: Pet Manager and Settings use narrow internal Electron IPC with sender and payload validation.
- Approved: Generated UI uses DOM/text rendering for state-derived values instead of HTML injection.
- Fixed optional: Added `node --check preload.cjs` to the desktop `check` script so the plain JS preload gets syntax validation.

Deferred optional improvements:

- Back up corrupt JSON before overwriting with normalized defaults.
- Add pure tests for state normalization/migration once a test framework exists.
- Derive tray default-pet label from app state when multiple real pets exist.
