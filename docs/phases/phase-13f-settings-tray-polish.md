# Phase 13F: Settings and Tray Polish

## Goal

Polish the remaining basic desktop surfaces so Settings and tray/menu copy match the Phase 13 visual/product direction.

## Non-goals

- No new settings schema.
- No new pet behavior beyond existing preference/reset actions.
- No new Integrations/Claude behavior.
- No remote assets or network calls.
- No changes to onboarding flow beyond label consistency if needed.

## User-visible/manual outcome

- Settings opens as a polished light OpenPets window instead of the older dark generic card layout.
- Settings groups current controls into clear cards/rows with better copy and consistent button/toggle styling.
- Tray menu uses current product labels, especially **Integrations** instead of **Configure Agents**.
- Tray menu order is clearer and still exposes setup, pet visibility, pause/resume, Pet Manager, Integrations, Settings, and Quit.

## Acceptance criteria

- Settings uses a light background/card style consistent with Onboarding, Pet Manager, and Integrations.
- Existing Settings controls are preserved:
  - Open default pet on app launch,
  - Speech bubbles enabled,
  - Pet scale coming later,
  - Reset default pet position.
- Settings controls remain wired to the existing preload/state behavior.
- Settings result/error feedback remains visible.
- Settings remains usable at 900×760 and minimum 720×520.
- No remote assets are added; Settings CSP remains restrictive and does not need `img-src` unless images are added.
- Tray menu user-facing copy uses current naming:
  - `Continue Setup...` can remain,
  - `Manage Pets...` remains acceptable,
  - `Configure Agents...` becomes `Integrations...`,
  - Quit and pause/show/hide labels remain clear.
- Tray menu order remains:
  - `OpenPets` disabled header,
  - separator,
  - conditional `Continue Setup...` plus separator when onboarding is incomplete,
  - `Default Pet: Built-in Pet`,
  - `Show/Hide Default Pet`,
  - `Pause/Resume All Pets`,
  - separator,
  - `Manage Pets...`,
  - `Integrations...`,
  - `Settings...`,
  - separator,
  - `Quit OpenPets`.
- Tray actions still call the same internal functions/windows.
- Agent setup window title/user-facing definition uses **Integrations** (`OpenPets — Integrations`) while preserving internal `agent-setup` identifiers.
- Settings includes visible `aria-live` status feedback for successful preference saves and reset actions, plus existing error feedback.
- Settings-specific light styles are scoped to `body[data-openpets-view="settings"]`; avoid broad edits to global `button`, `.card`, or `.setting-row` behavior.
- Settings has clear keyboard/focus behavior: labels toggle checkboxes, reset button is reachable, focus states are visible.
- `pnpm --filter @open-pets/desktop build` passes.
- `pnpm --filter @open-pets/desktop test` passes.
- Designer review is completed for Settings polish.
- Oracle implementation review is completed and feedback is dispositioned.

## Proposed files/directories

- `apps/desktop/src/windows.ts`
  - Redesign Settings markup and scoped Settings CSS.
- `apps/desktop/preload.cjs`
  - Adjust only if markup IDs/classes require it; preserve behavior.
- `apps/desktop/src/tray.ts`
  - Update menu labels/order only.
- `docs/phases/phase-13f-settings-tray-polish.md`
  - This spec, reviews, and dispositions.

## Technical approach

1. Keep `createSettingsHtml()` simple and data-free: no assets, no remote content.
2. Add scoped CSS under `body[data-openpets-view="settings"]` to avoid broad regressions.
3. Use native checkboxes/buttons with polished row/card styling; do not invent custom persistence.
4. Preserve existing element IDs used by preload:
   - `open-default-pet-on-launch`,
   - `speech-bubbles-enabled`,
   - `pet-scale-value`,
   - `reset-default-pet-position`.
5. Update tray label `Configure Agents...` to `Integrations...`; keep `openTaskWindow("agent-setup")` internally.
6. Update any visible `Configure Agents` window title/heading copy to Integrations while preserving internal task kind names.

## Risks and tradeoffs

- Settings shares global task-window CSS; keep new CSS scoped to Settings to avoid impacting other polished views.
- Tray label changes should not imply new functionality; use Integrations because that is now the actual window experience.

## Security/privacy notes

- No new IPC channels.
- No new external content.
- Existing preference update IPC sender allow-list remains Settings-only.
- Reset position remains the existing local state action.

## Test/check plan

Run:

```bash
pnpm --filter @open-pets/desktop build
pnpm --filter @open-pets/desktop test
```

If shared styles unexpectedly affect multiple windows, also run/manual-check the app via:

```bash
pnpm dev:desktop
```

## Manual verification guide

1. Run `pnpm dev:desktop`.
2. Open Settings from the tray and confirm it matches the light OpenPets polish direction.
3. Toggle “Open default pet on app launch” and confirm it persists after closing/reopening Settings.
4. Toggle “Speech bubbles enabled” and confirm it persists after closing/reopening Settings.
5. Toggle each checkbox twice in the same open Settings window and confirm controls re-enable after each save.
6. Restart the desktop app and confirm both toggles persist; for “Open default pet on app launch,” confirm startup behavior matches the setting.
7. Show the default pet, move it, click Reset default pet position twice, and confirm it returns near the bottom-right of the primary display and the button re-enables after each click.
8. Confirm Settings status/success text updates after toggles and reset, and errors still display if something fails.
9. Resize Settings to 720×520 and confirm no clipped controls, usable scrolling, and visible status/error feedback.
10. Open tray menu and confirm `Integrations...` appears instead of `Configure Agents...` in the expected order.
11. Click every tray menu item once where safe: Continue Setup (if visible), Show/Hide, Pause/Resume, Manage Pets, Integrations, Settings.
12. Click `Integrations...` and confirm the Integrations window opens with the user-facing title/copy updated.
13. Smoke-check Pet Manager and Onboarding for obvious style regressions.

## Oracle plan review

Reviewed by Oracle.

Blockers:

- Settings preload ID inventory omitted `pet-scale-value`, which current preload requires.

Should-fix feedback:

- Define exact tray order.
- Update all user-facing “Configure Agents” surfaces, including agent window title/definition.
- Clarify Settings feedback behavior with visible `aria-live` success/status text or narrow to errors only.
- Add explicit minimum-size manual checks.
- Add restart persistence verification for settings toggles and startup behavior.
- Strengthen reset-position manual verification by moving/showing the pet first.
- Require Settings-specific scoped light overrides, not broad global style edits.

Nice-to-have feedback:

- Add keyboard/focus accessibility acceptance.
- Replace stale Settings definition copy.
- Smoke-test all tray menu items after reorder/rename.

Verdict: conditionally approved after spec fixes.

## Oracle feedback disposition

Fixed:

- Added `pet-scale-value` to required ID inventory.
- Added exact tray order.
- Required user-facing Integrations naming for tray and window title/definition.
- Required visible Settings status/success feedback.
- Added minimum-size, restart persistence, startup behavior, reset-position, and full tray smoke manual checks.
- Required Settings-specific scoped styling and keyboard/focus criteria.

Accepted:

- Settings definition copy will be updated as part of the user-facing Integrations/Settings polish.

## Implementation notes

Implemented:

- Redesigned Settings as scoped light UI with header, grouped panels, polished rows, focus states, and status feedback.
- Preserved existing Settings controls and IDs, including `pet-scale-value`.
- Added `settings-status` as an `aria-live` region for saving/reset feedback.
- Updated user-facing agent setup title/heading to Integrations while preserving internal `agent-setup` IDs.
- Renamed tray `Configure Agents...` to `Integrations...` without changing the underlying action.

Follow-up Settings changes:

- Removed the Speech bubbles toggle because speech bubbles are now always enabled.
- Added a Launch OpenPets at login toggle backed by Electron login item settings on supported platforms.
- Kept unsupported platforms disabled with explanatory copy.

Validation passed:

```bash
pnpm --filter @open-pets/desktop build
pnpm --filter @open-pets/desktop test
```

Designer review: approved with no blockers or should-fix issues.

Oracle implementation review:

- Blocker: Settings controls were not re-enabled after successful saves/resets.
- Should-fix: failure status text could remain stuck on “Saving…”/“Resetting…”.
- Should-fix: manual verification should include repeated toggle/reset checks.
- Nice-to-have: add `role="status"` to Settings status.

Disposition:

- Fixed controls re-enabling in `renderSettings()`.
- Fixed failure status text for save/reset errors.
- Added repeated toggle/reset manual checks.
- Added `role="status"` to Settings status.
