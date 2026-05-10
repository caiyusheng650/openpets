# Phase 14: Pet Scale Setting

## Goal

Make the existing `petScale` preference real: Settings should let users choose pet size, and the desktop pet should update without layout shift or cropping.

## Non-goals

- No new pet animation states.
- No new pet window transparency/drag behavior beyond preserving current behavior.
- No new persisted schema version.
- No custom per-pet scale; scale applies to the default desktop pet renderer.
- No changes to MCP speech safety or bubble content.

## User-visible/manual outcome

- Settings shows a usable Pet scale control instead of “coming later.”
- Changing scale updates the visible default pet shortly after save.
- The pet remains unclipped at supported scale values.
- Chat bubble remains an overlay above the pet and does not move the pet.
- Reset position still places the pet near the bottom-right using the window bounds.

## Acceptance criteria

- Settings exposes pet scale choices: Small, Medium, Large.
- Default scale is **Medium**, matching the current polished pet size after the bugfix.
- Persisted `preferences.petScale` accepts only supported numeric values and normalizes invalid/old values to the default.
- `validatePreferencePatch()` accepts only supported `petScale` values from Settings IPC; unsupported/non-finite values are rejected.
- Current and newly created state files use the new default scale.
- Changing scale via Settings saves through existing `openpets:update-preferences` IPC.
- Changing scale refreshes the default pet content immediately if it is visible.
- Unrelated preference updates, including launch/speech toggles and tray show/hide writes, do not reset the selected scale.
- Scale applies to built-in and installed default pet sprites.
- Scale is passed explicitly through the default-pet render path; explicit agent pet windows are not accidentally changed unless deliberately passed a scale later.
- Pet shell/card dimensions, sprite transform, and bubble offset all derive from the same scale constant/value.
- Bubble vertical position is derived from scale and stays close to the pet without shifting the pet.
- Pet and bubble do not get cropped at supported scales.
- Existing IDs needed by Settings/preload remain stable or are intentionally updated together.
- `pnpm --filter @open-pets/desktop build` passes.
- `pnpm --filter @open-pets/desktop test` passes.

## Proposed files/directories

- `apps/desktop/src/app-state.ts`
  - Normalize/validate `petScale`.
  - Change default scale to Medium.
- `apps/desktop/src/pet-window.ts`
  - Use persisted `petScale` for sprite and bubble layout.
- `apps/desktop/src/windows.ts`
  - Replace disabled “Pet scale” row with a real select/segmented control.
  - Refresh pet content after scale updates.
- `apps/desktop/preload.cjs`
  - Render and bind scale control.
- `docs/phases/phase-14-pet-scale-setting.md`
  - This spec, reviews, and dispositions.

## Technical approach

1. Define supported scale values/default in a single pure source of truth, `app-state-core.ts`, and import/reuse where practical:
   - Small: `0.44`,
   - Medium: `0.56`,
   - Large: `0.72`.
2. Make Medium (`0.56`) the default.
3. Preserve old/corrupt state safety by normalizing any unsupported `petScale` to Medium. Old persisted `petScale: 1` should normalize to Medium because `1` was never the actual post-bugfix visual render scale.
4. In Settings, add a `select id="pet-scale"` or equivalent simple control.
5. On scale change, call existing `updatePreferences({ petScale })` and show status feedback.
6. In main process preference update handler, compare previous vs next `petScale` and call `refreshDefaultPetContent()` only when scale actually changes.
7. In pet renderer creation, read `state.preferences.petScale` and pass/use it for:
   - sprite transform scale,
   - scaled shell size,
   - installed card size,
   - bubble bottom offset.

## Risks and tradeoffs

- Window size stays fixed at 220×260 for simplicity. Large scale is capped to fit within that viewport with the current bubble max height.
- Position persistence stores top-left window position, not pet visual anchor. Changing scale may visually change the pet’s bottom/right footprint but should not jump the window unexpectedly.
- Existing old state files with `petScale: 1` will normalize to Medium, preserving the current corrected default size while allowing users to choose a smaller Small option.

## Security/privacy notes

- No new IPC channels.
- Existing Settings-only preference update IPC is reused.
- Scale input is validated in the main process/state normalization.
- No remote assets or code execution changes.

## Test/check plan

Run:

```bash
pnpm --filter @open-pets/desktop build
pnpm --filter @open-pets/desktop test
```

## Manual verification guide

1. Run `pnpm dev:desktop`.
2. Open Settings and confirm Pet scale offers Small, Medium, Large.
3. With the pet visible, switch between Small/Medium/Large and confirm the visible pet updates.
4. Change scale twice in the same Settings session and confirm controls stay enabled.
5. Toggle launch/speech settings and confirm the selected scale does not reset.
6. Test all scales with the built-in pet and with an installed pet set as default.
7. Trigger short and long speech bubbles/reactions at each scale, especially Large, and confirm bubble/pet are not cropped and the pet does not move.
8. Change scale while the pet is hidden, then show the pet and confirm the selected scale applies.
9. Confirm Reset default pet position still moves the pet near bottom-right at Small and Large.
10. Restart the app and confirm selected scale persists.
11. If manually editing state for verification, confirm fresh state defaults to Medium, old `petScale: 1` normalizes to Medium, and invalid values normalize to Medium.

## Oracle plan review

Reviewed by Oracle.

Blockers:

- Proposed Large `0.9` likely cannot meet no-cropping in the current fixed 220×260 window with max-height bubble.
- Settings IPC validation for `petScale` must be explicit because current `validatePreferencePatch()` only accepts launch/speech preferences.

Should-fix feedback:

- Define scale constants/default in one main-process source of truth.
- Clarify that old `petScale: 1` normalizes to the default because it was not the actual post-bugfix visual scale.
- Ensure unrelated preference updates do not reset scale.
- Pass scale explicitly through the default-pet path so explicit agent pet windows are not accidentally affected.
- Require derived dimensions/offsets to use the same scale.
- Refresh pet content only after real scale changes.

Manual verification gaps:

- Test built-in and installed default pets.
- Test long speech/reaction bubbles at each scale.
- Test fresh state, old `petScale: 1`, invalid values.
- Test repeated scale changes in one Settings session.
- Test scale while pet hidden, then show pet.
- Test reset position at Small and Large.

Verdict: conditionally approved after fixing scale sizing.

## Oracle feedback disposition

Fixed:

- Reduced Large to `0.84` to fit the fixed viewport with bubble.
- Added explicit Settings IPC validation requirement.
- Added one-source-of-truth scale constants requirement.
- Documented `petScale: 1` migration to the default.
- Added unrelated preference preservation, explicit default-pet scale path, derived dimension, and refresh-on-real-change criteria.
- Expanded manual verification matrix.

## Implementation notes

Implemented:

- Added supported scale constants in `app-state.ts`: Small `0.44`, Medium `0.56`, Large `0.72`.
- Moved scale constants/normalization into pure `app-state-core.ts` so lightweight tests can cover scale normalization without importing Electron.
- Changed default/invalid scale normalization to Medium.
- Added real Settings Pet scale select and status feedback.
- Added `petScale` validation to Settings preference IPC.
- Refreshes default pet content only when scale changes.
- Pet renderer derives shell size, sprite transform, installed-card size, and bubble offset from the selected scale.
- Explicit agent pet windows keep the Medium/default render scale for now; default pet windows use the saved preference.

Validation passed:

```bash
pnpm --filter @open-pets/desktop build
pnpm --filter @open-pets/desktop test
```
