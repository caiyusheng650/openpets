# Phase 09: First-run Onboarding

## Goal

Connect the existing pet manager, agent setup, default pet, and settings pieces into a clear first-run onboarding flow.

Phase 09 should make a fresh OpenPets install feel ready: the default pet appears, the user can optionally browse/install pets, configure Claude from the real Agent Setup flow, and finish with onboarding completion persisted.

## Non-goals

- No new agent integrations beyond the existing Claude Code setup/hook controls.
- No new catalog install mechanics beyond the existing Pet Manager install flow.
- No packaging/release installer work.
- No account system, telemetry, analytics, or network calls beyond the existing catalog fetch.
- No forced pet install; the bundled default pet remains enough to complete onboarding.
- No silent edits to Claude or other agent settings; existing confirmation/backup behavior remains required.
- No destructive onboarding reset UI beyond developer/manual reset instructions for this phase.

## User-visible/manual outcome

On a fresh app state, OpenPets opens a first-run onboarding window after startup.

The onboarding window has a simple wizard shape:

1. **Welcome**
   - Explains that OpenPets lives in the tray/menu bar.
   - Confirms the bundled default pet is already available.
   - Provides a Continue button.
2. **Pets**
   - Shows the current default pet and a short explanation that installing more pets is optional.
   - Provides an action to open the real Pet Manager.
   - Provides Skip/Continue.
   - If the catalog is unavailable, onboarding remains completable and points the user to try later from Pet Manager.
3. **Agents**
   - Shows Claude Code as the supported first integration for this MVP checkpoint.
   - Provides an action to open the real Agent Setup window.
   - Explains that setup is confirmation-based and can be skipped.
4. **Ready**
   - Confirms OpenPets is ready.
   - Offers quick actions to open Pet Manager or Agent Setup.
   - Finish persists onboarding completion and closes the onboarding window.

The tray remains usable during onboarding. Closing onboarding without finishing should not mark onboarding complete; it should be possible to reopen onboarding from the tray until completed.

## Acceptance criteria

- App state persists onboarding completion, for example `preferences.onboardingCompleted` or equivalent versioned state.
- State normalization handles missing/old state by treating onboarding as incomplete.
- Fresh app state opens onboarding automatically after app initialization.
- The default pet appears early when `openDefaultPetOnLaunch` is enabled, independent of onboarding completion.
- Onboarding is implemented as a normal sandboxed/context-isolated Electron task window with the existing preload/security posture.
- Onboarding uses dedicated IPC handlers with sender validation; only the onboarding renderer can complete onboarding.
- Onboarding IPC sender validation must use the main-process `taskWindows` / `webContents.id` mapping, not renderer-declared DOM attributes.
- If the shared preload exposes broad APIs, existing main-process IPC sender checks must deny pet install/remove, preference mutation, and agent setup mutation from the onboarding window.
- Onboarding cannot directly mutate pet installs or agent configuration except by opening the existing Pet Manager / Agent Setup flows.
- Onboarding includes actions to:
  - continue through steps,
  - open Pet Manager,
  - open Agent Setup,
  - finish onboarding,
  - close without completing.
- Onboarding completion persists and prevents automatic reopening on the next app launch.
- Finishing onboarding closes the onboarding window and refreshes the tray immediately so **Continue Setup...** disappears without restart.
- Until onboarding is completed, the tray exposes a way to reopen onboarding, for example **Continue Setup...**.
- After onboarding is completed, the tray no longer shows the onboarding continuation item by default.
- Catalog failure does not block onboarding completion.
- Agent detection/configuration errors do not block onboarding completion.
- No automated test touches real Claude settings or real user data.
- Automated checks cover onboarding state normalization and completion persistence behavior.
- `pnpm test` passes.
- `pnpm check` passes.

## Proposed files/directories

- `apps/desktop/src/app-state.ts`
  - Add persisted onboarding completion flag with backwards-compatible normalization.
  - Add a narrow completion helper, e.g. `completeOnboarding()`.
- `apps/desktop/src/windows.ts`
  - Add `onboarding` task window kind and HTML.
  - Add IPC handlers for onboarding snapshot/completion and opening Pet Manager / Agent Setup from onboarding.
  - Reuse existing CSP, sandbox, context isolation, navigation blocking, and sender validation patterns.
- `apps/desktop/src/main.ts`
  - Decide when to open onboarding automatically after startup.
- `apps/desktop/src/tray.ts`
  - Add **Continue Setup...** while onboarding is incomplete.
  - Refresh menu after onboarding completion.
- `apps/desktop/preload.cjs`
  - Expose a narrow `openpetsOnboarding` bridge only for onboarding actions.
- `apps/desktop/src/check-onboarding-state.ts`
  - Contract checks for state migration/completion through extracted pure normalization/completion helpers or injected temp state paths.
  - Do not import Electron-bound `app-state.ts` directly from plain Node tests if that couples tests to Electron `app.getPath`.
- `docs/phases/phase-09-first-run-onboarding.md`

## Technical approach

### State model

Extend the existing versioned app state with onboarding completion.

Preferred minimal shape:

```ts
preferences: {
  defaultPetId: string;
  openDefaultPetOnLaunch: boolean;
  speechBubblesEnabled: boolean;
  petScale: number;
  onboardingCompleted: boolean;
}
```

Default/missing value should be `false`, so existing installs see onboarding once after upgrading. If that is too disruptive during development, the implementation may use a developer reset/manual test path, but the production behavior should remain first-run based.

Add narrow exported helpers:

```ts
isOnboardingCompleted(): boolean
completeOnboarding(): OpenPetsStateV1
```

`completeOnboarding()` should only set the completion flag and persist via existing atomic state write behavior.

### Startup behavior

Startup order should stay stable:

1. Initialize state.
2. Install internal UI handlers.
3. Create tray.
4. Install default pet display handlers.
5. Start local IPC.
6. Show default pet if preference says so.
7. Open onboarding if incomplete.
8. Refresh tray.

Opening onboarding should not delay local IPC startup or default pet display. If opening the window fails, log the error and keep the app usable from tray.

### Window and IPC

Add an `onboarding` task window kind rather than a separate dashboard architecture.

The onboarding renderer should be static inline HTML loaded through the same data URL pattern as existing task windows. It should use the existing preload bridge, not Node integration.

Suggested bridge:

```ts
window.openpetsOnboarding = {
  getSnapshot(): Promise<{ defaultPetName: string; onboardingCompleted: boolean }>;
  complete(): Promise<OpenPetsStateV1>;
  openPetManager(): Promise<void>;
  openAgentSetup(): Promise<void>;
}
```

Keep the snapshot lightweight: default pet/onboarding state only. Phase 09 does not need to duplicate the full Pet Manager or Agent Setup UIs inside onboarding; opening the real windows is enough and avoids parallel state/config logic. Do not expose Claude settings paths, Claude config previews, or detailed agent status in onboarding.

Sender validation should allow onboarding access only through the existing main-process window-kind mapping from `webContents.id` to `taskWindows`. Renderer-declared values like `data-openpets-view="onboarding"` may be useful for the preload bridge but must not be the trust boundary.

### Onboarding UI details

The UI should be intentionally small and clear, not a full dashboard:

- One card/wizard window, roughly the same size as other task windows.
- Step indicators for Welcome / Pets / Agents / Ready.
- Primary and secondary actions per step.
- Clear skip language: pet installs and agent setup can be done later.
- Explicit reminder that Claude setup may edit user-level Claude settings only after confirmation and backups.

### Reopen behavior

Before completion:

- App startup opens onboarding automatically.
- Tray shows **Continue Setup...**.
- Closing the window keeps completion false.

After completion:

- App startup does not auto-open onboarding.
- Tray omits **Continue Setup...**.
- Pet Manager, Agent Setup, and Settings remain available normally.

### Reset/manual testing behavior

Phase 09 does not need an end-user reset UI. Manual verification can reset onboarding by deleting the dev Electron user-data directory or editing/removing the dev state file documented by app logs.

If a small developer-only helper is cheaper and safer, it may be added only as a documented internal check command, not as product UI.

## Risks and tradeoffs

- **Onboarding could become a second implementation of Pet Manager/Agent Setup.** Avoid this by using onboarding as a guide that opens the real windows.
- **Existing dev installs may see onboarding after the state schema changes.** This is acceptable for first-run behavior; manual instructions should include how to mark complete or reset state.
- **Catalog/agent setup failures can make onboarding feel blocked.** The flow must make those steps optional and completable.
- **Window focus could be annoying at startup.** The default pet and tray remain primary; onboarding should be a normal window and not repeatedly refocus if closed.
- **State tests may be coupled to Electron `app`.** Prefer extracting pure normalization/completion helpers if needed instead of brittle Electron test setup.

## Security/privacy notes

- Onboarding must not silently configure agents or install pets.
- Claude setup remains routed through the existing Agent Setup controls with explicit confirmation and backups.
- No onboarding payload should include Claude config contents beyond what existing Agent Setup already exposes.
- Renderer stays sandboxed/context-isolated with no Node integration.
- CSP should block external resources and navigation.
- IPC sender validation must prevent other windows from invoking onboarding completion if practical within the current data URL sender model.

## Test/check plan

- Add deterministic contract coverage for:
  - missing/old state normalizes `onboardingCompleted` to `false`,
  - completion helper persists `true`,
  - preference updates preserve onboarding completion,
  - onboarding completion does not alter installed pets/default pet/agent configuration state.
- Run:

```bash
pnpm test
pnpm check
```

Manual verification should use a fresh or reset dev app state.

## Manual verification guide

1. Reset the dev app state by deleting the OpenPets dev user data directory shown in the app startup log, or remove/edit `openpets-state.json` so onboarding is incomplete.
2. Run:

```bash
pnpm dev:desktop
```

3. Confirm the default pet appears if `openDefaultPetOnLaunch` is enabled.
4. Confirm the onboarding window opens automatically.
5. On Welcome, click Continue.
6. On Pets, click the Pet Manager action and confirm the real Pet Manager opens. Close or leave it open, then continue/skip.
7. On Agents, click the Agent Setup action and confirm the real Configure Agents window opens with Claude controls. Do not apply config unless intentionally testing Claude setup. Continue/skip.
8. On Ready, click Finish.
9. Quit OpenPets and launch again with `pnpm dev:desktop`.
10. Confirm onboarding does not auto-open after completion.
11. Reset onboarding state again, relaunch, close the onboarding window without finishing, and confirm **Continue Setup...** is available from the tray and reopens onboarding.
12. Simulate catalog unavailable behavior if practical, for example by disconnecting network or using an invalid catalog URL if supported by the dev environment; confirm onboarding can still be completed.
13. Confirm that a machine without Claude Code configured, or with Claude setup errors, can still complete onboarding.
14. Confirm Claude settings are unchanged unless existing Agent Setup configure/install buttons were explicitly used.

Expected results:

- Onboarding never blocks app/tray/default pet usage.
- Skipping pet install and agent setup still allows finishing.
- Completion persists across restart.
- No Claude settings are modified unless you explicitly use existing Agent Setup configure/install buttons.

## Oracle plan review

Reviewed by Oracle for architecture fit, scope, security/privacy, state migration, testing, and cross-platform risks.

Blockers: none.

Should-fix feedback:

- Ensure onboarding IPC sender validation uses main-process `taskWindows` / `webContents.id` mapping, not renderer-declared DOM values.
- Keep onboarding preload/API narrow; if shared preload exposes broad APIs, existing IPC sender checks must deny install/remove/preferences from onboarding.
- Add acceptance criteria that Finish closes onboarding and refreshes tray so **Continue Setup...** disappears immediately.
- Avoid importing Electron-bound `app-state.ts` directly from Node tests; extract pure normalization/completion helpers or inject temp state paths.
- Keep onboarding snapshot minimal: default pet/onboarding state only; do not duplicate Claude detection/status or expose Claude settings paths in onboarding.
- Manual verification should include Claude unavailable/catalog unavailable cases and confirm no Claude settings changed unless Agent Setup buttons are explicitly used.

Nice-to-have feedback:

- Add a small “Start using OpenPets”/Finish action on Ready that closes onboarding.
- Place tray **Continue Setup...** above manager/settings while incomplete for discoverability.
- Consider a developer-only env var to force onboarding incomplete for manual testing.

Verdict: implementation-ready after sender-validation/preload and state-test clarifications. Scope is appropriate as one phase because it connects existing surfaces instead of rebuilding pet/agent setup logic.

## Oracle feedback disposition

Fixed:

- Added explicit main-process `webContents.id` sender-validation requirement.
- Added shared-preload/broad-API guard requirement.
- Added finish-close/tray-refresh acceptance criterion.
- Clarified state tests should use extracted pure helpers or injected temp state paths, not brittle Electron-bound imports.
- Reduced onboarding snapshot to default pet/onboarding state only and forbade exposing Claude config paths/previews in onboarding.
- Added manual checks for catalog unavailable, Claude unavailable/error states, and no Claude settings mutation unless existing Agent Setup controls are explicitly used.

Accepted nice-to-have:

- Ready/Finish action and discoverable tray placement are included in implementation guidance.

Deferred:

- Developer-only env var to force onboarding incomplete. Manual reset via dev user-data/state file is enough for Phase 09 unless implementation testing shows reset friction is high.

## Oracle implementation review

Initial implementation review:

Blockers: none.

Should-fix feedback:

- Remove onboarding access to the broad `openpets:get-state` handler; onboarding should use only its minimal snapshot.
- Return a minimal completion result instead of the full app state from onboarding completion.
- Wrap automatic onboarding startup so a window creation failure does not exit the tray app.
- Improve onboarding state tests so completion remains true after preference-like updates, and prefer temp/injected persistence coverage if practical.
- Show the current default pet on the Pets step, not only Welcome.

Nice-to-have feedback:

- Disable Finish while completion is in flight.
- Step indicators/back navigation can be considered later if cheap.
- Manual Electron verification is still required.

Final Oracle re-check:

- Blockers: none.
- Remaining should-fix: none from the previous review.
- Verified previous should-fix items are resolved.
- Verdict: proceed to manual Electron verification before user acceptance.

## Oracle implementation feedback disposition

Fixed:

- Added root `pnpm dev:desktop` script so the manual verification command works from the workspace root.
- Removed onboarding from `openpets:get-state` allowlist.
- Onboarding completion now returns `{ onboardingCompleted: true }` instead of full app state.
- Wrapped startup onboarding open in a try/catch so tray/default-pet startup continues on failure.
- Added state-check coverage that onboarding completion remains true after a preference-like update while other preferences are preserved.
- Added current default pet display to the Pets step.
- Disabled the Finish button while completion is in flight.

Deferred:

- Temp-path full app-state persistence test. The current app-state module is Electron-bound through `app.getPath`; Phase 09 covers the extracted pure onboarding normalization/completion contract and leaves broader state-store injection for a later hardening/refactor if needed.
- Clickable/back-capable step indicators. Forward-only onboarding keeps Phase 09 simpler and matches the approved scope.
