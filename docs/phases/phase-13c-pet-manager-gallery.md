# Phase 13C: Pet Manager Gallery

## Goal

Redesign the Pet Manager into a polished pet installation/gallery screen inspired by `lfs/pets.png`, while preserving the existing real catalog, install, set-default, and remove behavior.

## Non-goals

- No changes to catalog source, pet zip validation, installation security, or state schema.
- No remote image loading beyond existing catalog preview URLs already used by catalog metadata.
- No new pet categories in persisted data; filters can be UI-derived from current pet text/ids.
- No using `lfs/pets.png` as a runtime image or packaged asset.
- No full redesign of Agent Setup, Settings, or onboarding beyond shared task-window sizing/styles if required.

## User-visible/manual outcome

Opening Pet Manager shows a light, polished two-column install page:

- OpenPets brand art at top-left,
- search and simple gallery filter pills,
- install/selectable pet cards with pixel-art previews where available,
- a large right-side selected pet detail panel,
- focused action buttons that install, set default, remove, or indicate selected/protected/broken state,
- existing catalog/install behavior still works.

## Acceptance criteria

- Pet Manager visually follows `lfs/pets.png` direction: light background, two-column gallery/detail layout, pixel-game product feel, rounded cards, strong primary actions.
- `lfs/pets.png` remains reference-only and is not loaded by app code or copied into desktop assets.
- Use existing bundled/local assets where safe, including `apps/desktop/assets/onboarding-logo.webp` for brand identity. Do not embed the large `default-pet-spritesheet.webp` in the Pet Manager data URL.
- Catalog pet preview images may be shown only from validated `CatalogPetV2.preview` values returned by main-process catalog data. The renderer must not independently construct remote image URLs.
- Pet Manager CSP must be exactly scoped for required image sources, e.g. `img-src data: https://openpets.dev`; no broad `https:`, `*`, or `file:` sources.
- Do not use mutable `InstalledPetState.source.preview` for remote rendering unless it is revalidated against the same catalog preview rules.
- Catalog previews are spritesheets; the UI must crop/display a single-frame thumbnail/preview, not show the whole sheet.
- Image failures/offline state must degrade gracefully: no broken image icon, neutral/blank preview surface, and install/default/remove actions remain usable.
- All catalog/state strings are inserted with DOM APIs/textContent, not `innerHTML`.
- Existing Pet Manager operations continue to work:
  - install catalog pet,
  - set installed pet as default,
  - remove non-protected installed pet,
  - protected built-in/default pet cannot be removed,
  - broken installed pets cannot be selected as default.
- Search continues to filter catalog/gallery pets.
- Quick filters are limited to `All` and `Installed`; do not add category filters like `Cute`, `Helpers`, or `Robots` until backed by real catalog metadata.
- The large detail panel does not include decorative metadata pills like `Free`, `Open source`, or `Works in terminal`; those are unnecessary until backed by real catalog metadata.
- Detail actions are limited to real Pet Manager operations: `Install`, `Set Default`, and `Remove`, with disabled/status variants such as `Selected`, `Protected`, `Broken`, or `Installing…`.
- Keyboard users can tab to search, filter pills, pet cards/actions, and detail actions.
- The Pet Manager opens at 1160×780 and remains usable at 720×520 with vertical scrolling/responsive stacking.
- `pnpm --filter @open-pets/desktop build` passes.
- `pnpm --filter @open-pets/desktop test` passes.
- `pnpm package:desktop:dir` passes because Pet Manager CSP/asset packaging contracts change.
- Designer review is completed before manual verification.
- Oracle implementation review is completed and feedback is dispositioned.

## Proposed files/directories

- `apps/desktop/src/windows.ts`
  - Update Pet Manager markup and scoped CSS.
  - Add Pet Manager image CSP for data/local catalog previews as needed.
- `apps/desktop/preload.cjs`
  - Replace the current section-card renderer with gallery/detail rendering.
  - Keep IPC calls and validation boundaries unchanged.
- `apps/desktop/src/check-packaging-contract.ts`
  - Update assertions if the Pet Manager starts depending on bundled image assets/CSP.
- `docs/phases/phase-13c-pet-manager-gallery.md`
  - This spec, reviews, and dispositions.

## Technical approach

1. Keep backend/state/install behavior unchanged.
2. Build one normalized UI list from installed pets plus catalog pets:
   - installed/default state comes from `OpenPetsStateV1`,
   - catalog data comes from `getCatalog()`.
3. Render a left gallery with:
   - search,
   - filter pills (`All`, `Installed`) derived from installed/default state,
   - cards showing thumbnail, name, subtitle, and selected/install state.
4. Render a right detail panel for the selected pet:
   - title/description,
   - large preview image,
   - concise install/default/protected/broken status,
   - small preview tiles reusing available image material,
   - primary action (`Install`, `Selected`, or `Set Default`) and secondary action (`Remove` or `Protected`) where applicable.
5. Use safe image behavior:
   - bundled default uses data URL or local packaged asset strategy already established,
   - catalog previews use only validated `CatalogPetV2.preview` URLs from main-process catalog data, scoped to `https://openpets.dev`,
   - card/mini preview images crop a single sprite frame from spritesheets using CSS background strategy,
   - the detail spotlight animates the pet sprite itself without decorative platform/fallback art,
   - image error handling is attached with DOM listeners in preload (`addEventListener("error", ...)`), not inline attributes,
   - failures hide the broken image and leave a neutral preview surface.
6. Preserve accessibility:
   - cards are buttons or contain focusable buttons,
   - selected card uses `aria-pressed` or `aria-current`,
   - detail status updates avoid inaccessible-only visual changes.

## Risks and tradeoffs

- Catalog previews are remote URLs; they can fail offline. The UI must remain usable with neutral/blank preview surfaces.
- This is a bigger Pet Manager UI rewrite than Phase 13A; keep install/state/security code unchanged to limit risk.
- Without real per-animation preview images, the Idle/Happy/Wave tiles will reuse available pet art rather than showing true animation states.
- Category filters are intentionally omitted until catalog metadata includes real tags.

## Security/privacy notes

- No new persisted data.
- No broad install behavior changes; narrow stale-target cleanup is allowed when a previously failed/manual install leaves files on disk while state says the pet is not installed.
- No direct use of `lfs/pets.png` at runtime.
- Keep Electron renderer sandbox/context isolation unchanged.
- CSP should allow only the image sources needed for data bundled assets and exact existing catalog preview origin (`https://openpets.dev`); no remote script/style execution and no `file:` images.
- Removing a removable current-default pet must preserve existing safe fallback behavior to the built-in pet.

## Test/check plan

Run:

```bash
pnpm --filter @open-pets/desktop build
pnpm --filter @open-pets/desktop test
```

```bash
pnpm package:desktop:dir
```

## Manual verification guide

1. Run `pnpm dev:desktop`.
2. Open Pet Manager from the tray.
3. Confirm the page resembles `lfs/pets.png` direction: light two-column gallery/detail layout, not a literal screenshot paste.
4. Confirm the default/bundled pet is selected by default and shows a large detail panel.
5. Type in search and confirm gallery cards filter.
6. Click `All` and `Installed` and confirm results update gracefully.
7. Click a catalog pet and confirm the detail panel updates.
8. Install a catalog pet and confirm it becomes installed/selectable without breaking the UI.
9. Set an installed pet as default and confirm selected/default state updates.
10. Remove a non-protected installed pet and confirm it disappears/falls back safely.
11. If the current default is a removable installed pet, remove it and confirm OpenPets falls back safely to the built-in/default pet.
12. Simulate offline/catalog error or use fixture/error state if available; confirm the gallery remains usable and image failures show neutral preview surfaces with no broken image icon.
13. Confirm a broken installed pet, if present, is shown but cannot be selected as default.
14. Confirm an installed pet missing from the current catalog still appears and remains manageable.
15. Resize to 720×520 and confirm the layout remains usable with scrolling.
16. Quickly inspect onboarding, Settings, and Agent Setup for obvious shared-style regressions.

## Oracle plan review

Reviewed by Oracle.

Blockers: none.

Should-fix feedback:

- Clarify remote preview policy: only validated `CatalogPetV2.preview` from main-process catalog data; exact CSP such as `img-src data: https://openpets.dev`; no broad `https:`, `*`, or `file:`; no mutable `InstalledPetState.source.preview` without revalidation.
- Require previews to crop a single sprite frame, not show full spritesheets.
- Use DOM `addEventListener("error", ...)` for image failures, not inline `onerror` attributes.
- Add offline/image-failure behavior: no broken image icon, visible fallback thumbnail/card/detail, install/default/remove still usable.
- Preserve current-default removal semantics explicitly: removable current default can still be removed and safely falls back to built-in.
- Require `textContent`/DOM APIs for all catalog/state strings; no `innerHTML`.
- Make `pnpm package:desktop:dir` required if CSP/assets/packaging contract changes for gallery images.

Nice-to-have feedback:

- Use `loading="lazy"`, `decoding="async"`, and `referrerpolicy="no-referrer"` for remote preview images.
- Keep gallery model helpers small.
- Add manual checks for catalog offline/fixture/error, broken installed pet, and installed pet missing from current catalog.
- Add package contract checks for Pet Manager CSP and bundled logo/default thumbnail assets if used.

Verdict: not implementation-ready until image/CSP rules and spritesheet cropping/fallback behavior are tightened.

## Oracle feedback disposition

Fixed:

- Added exact remote preview policy and CSP constraints.
- Added single-frame spritesheet crop requirement.
- Replaced inline `onerror` language with DOM listener requirement.
- Added offline/image-failure fallback acceptance and manual checks.
- Added current-default removal fallback acceptance.
- Added DOM/textContent requirement.
- Made `pnpm package:desktop:dir` required for this phase.
- Added manual checks for broken/missing/catalog error states.

Accepted:

- Use lazy/async/no-referrer attributes for remote preview images.
- Keep gallery helpers small and avoid framework-like preload code.
- Add package contract checks for Pet Manager CSP and bundled assets when implemented.

## Implementation review

Reviewed by Designer and Oracle after implementation.

Validation passed:

```bash
pnpm --filter @open-pets/desktop build
pnpm --filter @open-pets/desktop test
pnpm package:desktop:dir
```

Initial Designer should-fix feedback:

- Add keyboard-visible focus styling for Pet Manager cards.
- Adjust spritesheet crop/container sizing to avoid distorting the first-frame preview.

Initial Oracle should-fix feedback:

- Fix nested interactive keyboard behavior where card-level Enter/Space handling could intercept nested action button keyboard activation.
- Tighten packaging contract CSP assertions so onboarding and Pet Manager CSPs are checked separately and exactly.

Final Designer verdict: approved. Previous UI/accessibility feedback resolved.

Final Oracle verdict: approved for closeout. Previous security/CSP/data-integrity feedback resolved.

## Implementation feedback disposition

Fixed:

- Added `.pm-pet-card:focus-visible` styling.
- Adjusted thumbnail/mini sprite containers to match the 8×9 spritesheet frame aspect more closely.
- Guarded card keydown handling with `event.target !== card` so nested action buttons keep normal keyboard activation.
- Tightened package contract checks to assert exact onboarding and Pet Manager CSP strings.
- Strengthened catalog preview URL validation with `URL` parsing, exact protocol/host/no credentials/no port/path/`.webp` checks.
- Updated filter rendering so active visual state stays in sync and detail prefers visible filtered pets.

## Manual follow-up fixes

Fixed after manual testing:

- Pet Manager now opens at 1160×780 while other task windows keep their prior default sizing.
- Removed the large embedded default spritesheet from Pet Manager HTML to avoid Electron `ERR_INVALID_URL` from oversized data URLs.
- Replaced visible `<img>` sprite cropping with validated, preloaded CSS background sprites so previews do not show broken image icons.
- Removed decorative platform/fallback art from the detail spotlight; the selected pet sprite is the focus.
- Added install cleanup for stale target directories before renaming a validated temp install directory into place.
- Added Pet Manager `no-referrer` meta for CSS background preview requests.

Accepted:

- Idle/Happy/Wave mini tiles currently reuse the available first-frame crop; true per-state animation previews can wait for explicit animation metadata.
