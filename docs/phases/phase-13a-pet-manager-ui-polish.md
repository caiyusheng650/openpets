# Phase 13A: Pet Manager UI/UX Polish

## Goal

Make the Pet Manager feel like the first polished OpenPets desktop window and establish a reusable visual direction for later Settings, Agent Setup, and Onboarding polish.

This phase focuses on one window only: Pet Manager.

## Non-goals

- No Settings, Agent Setup, or Onboarding redesign.
- No new install/remove/default product behavior beyond small UI affordances needed for clarity.
- No new pet catalog backend, marketplace, or publishing flow.
- No remote image rendering in the renderer.
- No framework migration; keep the current vanilla preload-driven UI.
- No weakening zip/catalog/install safety.
- No public distribution/signing work.

## User-visible/manual outcome

Opening **Manage Pets** from the tray shows a premium compact desktop UI instead of a wireframe list.

The user should be able to quickly understand:

- which pet is currently default,
- which pets are installed,
- which catalog pets can be installed,
- what actions are safe/available,
- whether catalog data is live, fixture, loading, empty, or errored.

## Acceptance criteria

- Pet Manager copy no longer says or feels like placeholder/wireframe.
- Pet Manager has a polished header, clear current-default summary, installed-pets section, catalog/search section, and error/status surfaces.
- Installed cards clearly distinguish default, built-in/protected, broken, and removable pets.
- Catalog cards clearly distinguish installable, installed, default, and unavailable/broken states.
- Buttons have clear hierarchy and disabled/busy states; no tiny ambiguous controls.
- Search has a polished empty state when no catalog pets match.
- Catalog status explains live vs fixture vs error without looking like debug text.
- The design uses consistent spacing, typography, radii, shadows, badges, and compact desktop proportions.
- No external images are introduced into the Pet Manager renderer.
- Pet install, remove, and set-default behavior remains unchanged and safe.
- Pet Manager can still render if catalog fetch falls back to fixture or fails.
- Pet Manager rendering continues to use DOM APIs and `textContent` for all catalog/state strings; no `innerHTML` for catalog-provided content.
- No CSP `img-src` expansion, no `<img>`, and no CSS `background-image` using catalog preview URLs in Phase 13A.
- Existing visible placeholder copy is removed from Pet Manager window definitions and user-facing text.
- `pnpm --filter @open-pets/desktop build` passes.
- `pnpm --filter @open-pets/desktop test` passes.
- If shared task-window styles are changed, verify Settings/Agent Setup/Onboarding are not obviously broken.
- Designer review is completed before final manual verification.
- Oracle implementation review is completed and feedback is dispositioned.

## Proposed files/directories

- `apps/desktop/src/windows.ts`
  - Update Pet Manager HTML structure and Pet Manager-specific/shared styling.
  - Remove placeholder Pet Manager description.
- `apps/desktop/preload.cjs`
  - Refactor `renderPetManager` / `renderCatalog` card DOM for polished UI states.
  - Add small helper functions for status labels, card metadata, action rows, and empty states.
- `docs/phases/phase-13a-pet-manager-ui-polish.md`
  - This phase spec, reviews, and dispositions.
- Potentially `docs/mvp-validation.md`
  - Add a short Pet Manager visual verification note if useful.

## Technical approach

1. Keep scope to Pet Manager:
   - Require Pet Manager selectors under `body[data-openpets-view="pet-manager"]` unless intentionally changing shared task-window tokens.
   - Avoid broad restyling of Settings/Agent Setup/Onboarding unless shared base styles must be adjusted carefully.
   - Remove the existing placeholder copy from `taskWindowDefinitions.pet-manager.description` and visible Pet Manager text.
2. Improve information architecture:
   - Add a hero/header area with concise product copy.
   - Add a current-default summary card derived from `state.preferences.defaultPetId` and installed pet state.
   - Keep installed pets and catalog as separate sections.
3. Polish cards:
   - Installed cards: pet name, id/source metadata, status badges, concise description, broken reason if present, primary/default action, secondary/remove action.
   - Catalog cards: pet name, id metadata, description, installed/default badges, install or set-default/remove actions.
4. Improve state surfaces:
   - Catalog source/status pill for live/fixture/error.
   - Empty installed/catalog search states with plain helpful copy.
   - Inline global error surface that is visually distinct but not alarming for non-destructive errors.
5. Improve interaction polish:
   - Button hierarchy: primary install/set-default, secondary remove/protected.
   - Busy state remains button-level/card-level without changing backend operation semantics.
   - Use specific CSS transitions only; no `transition: all`.
   - Add subtle card hover/focus/press feedback without distracting animations.
6. Preserve security constraints:
   - No remote images in Pet Manager renderer.
   - Do not add `img-src` to the Pet Manager CSP, do not add `<img>`, and do not use catalog preview URLs as CSS backgrounds in this phase.
   - Continue using textContent/DOM APIs for user/catalog strings.
   - Keep renderer CSP restrictive.

## Risks and tradeoffs

- Pet Manager currently shares task-window CSS with other windows. Over-broad changes could accidentally regress Settings/Agent Setup/Onboarding.
- Preview thumbnails would be desirable but can create CSP/cache/security work. Defer image previews unless implemented through a safe later design.
- Pure vanilla DOM UI can become messy. Keep helpers small and avoid a framework rewrite.
- Catalog can contain many pets; keep cards reasonably compact and avoid heavy DOM work or animations.

## Security/privacy notes

- Pet Manager still must not execute pet content or scripts.
- Catalog strings must be inserted with `textContent`, not `innerHTML`.
- Install/remove/default actions must keep the existing IPC allowlist and validation.
- No remote image URLs should be added to CSP for this phase.
- No `innerHTML` should be used for catalog-provided or state-provided strings.

## Test/check plan

Run:

```bash
pnpm --filter @open-pets/desktop build
pnpm --filter @open-pets/desktop test
```

If shared styles or packaging-sensitive files change unexpectedly, also run:

```bash
pnpm check
```

## Manual verification guide

Manual verification is provided after implementation. It should include:

1. Run `pnpm dev:desktop`.
2. Open **Manage Pets** from the tray.
3. Confirm the window feels polished, compact, and not wireframe.
4. Confirm current default pet is obvious.
5. Search the catalog and confirm empty/search states look good.
6. Confirm live/fixture/error catalog status is understandable; simulate unavailable catalog only if feasible without expanding scope.
7. Install a catalog pet if available and confirm busy state during install.
8. Set an installed catalog pet as default.
9. Remove a removable pet and confirm busy state during remove.
10. Confirm broken/protected/default button states are understandable.
11. Open Settings/Agent Setup/Onboarding quickly to confirm shared styles were not obviously broken if shared styles changed.

## Oracle plan review

Reviewed by Oracle.

Blockers: none.

Should-fix feedback:

- Tighten style isolation under `body[data-openpets-view="pet-manager"]` unless intentionally changing shared tokens.
- Add explicit acceptance that catalog/state strings use DOM APIs/`textContent`, no `innerHTML` for catalog content.
- Add manual verification for catalog unavailable/error/fixture status if feasible, busy install/remove states, set default, remove, and shared window regression check.
- Make “no remote image rendering” concrete: no CSP `img-src` expansion, no `<img>`, no catalog preview CSS backgrounds.
- Explicitly remove existing Pet Manager placeholder copy.

Nice-to-have feedback:

- Add a small Pet Manager visual checklist to `docs/mvp-validation.md`.
- Define a few grouped design tokens/comments without building a full design system.
- Add compact empty states for no installed pets beyond built-in and no catalog matches.
- Keep helper extraction modest; avoid a mini framework.

Verdict: implementation-ready after small spec tightening.

## Oracle feedback disposition

Fixed:

- Added selector isolation requirement under `body[data-openpets-view="pet-manager"]`.
- Added explicit `textContent`/DOM API requirement and `innerHTML` prohibition for catalog/state strings.
- Added concrete no-remote-image constraints.
- Added placeholder-copy removal as an explicit implementation item.
- Expanded manual verification for catalog status, busy states, set-default/remove actions, and shared-window regression checks.

Accepted:

- Add Pet Manager visual checklist to `docs/mvp-validation.md` if implementation changes warrant it.
- Use modest grouped design tokens/comments only if helpful.
- Add compact empty states for catalog/no-extra-installed states.
- Keep helper extraction modest.

## Designer implementation review

Reviewed by Designer after implementation.

Blockers: none.

Should-fix: none.

Nice-to-have feedback:

- Make Pet Manager empty states span the full grid width.
- Make the current default card heading slightly larger to reinforce hierarchy.

Verdict: approved. The visual direction is a substantial step up from wireframe and establishes a good baseline for future windows.

## Designer implementation feedback disposition

Fixed:

- Empty states now span all grid columns.
- Current default card heading is larger than regular card headings.

## Oracle implementation review

Reviewed by Oracle after implementation and follow-up fixes.

Initial should-fix feedback:

- Restore remove affordance for a removable current default pet.
- Show broken state on catalog cards.
- Avoid appending empty actions rows for current-default catalog cards.
- Fix current-default remove busy-state restore so a newly rendered protected default does not get an enabled dead Protected button.

Final review:

Blockers: none.

Should-fix: none.

Nice-to-have feedback:

- Manually verify Settings/Agent Setup/Onboarding because shared button/card/search styles changed.
- Consider shortening catalog error pill text if it feels too debuggy.
- Future: centralize small DOM helpers if Pet Manager grows further.

Verdict: approved for manual verification. Removable defaults remain actionable, broken catalog states are visible, empty action rows are avoided, busy-state restoration is fixed, and CSP/textContent/no-remote-image constraints remain intact.

## Oracle implementation feedback disposition

Fixed:

- Current default card now includes badges, broken reason, and Remove/Protected action.
- Catalog cards now show Broken badge and broken reason for installed broken pets.
- Empty catalog card action rows are no longer appended.
- Current-default remove busy restore no longer runs after successful re-render, preventing stale enabled Protected buttons.

Accepted:

- Shared-window visual smoke check is included in manual verification.
- Catalog error pill copy can be adjusted later if it feels too debug-like in manual testing.
- DOM helper centralization is deferred until more UI windows are polished.
