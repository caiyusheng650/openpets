# Phase 13B: Onboarding Greeting Polish

## Goal

Turn the first onboarding screen into a polished OpenPets greeting inspired by `lfs/greeting.png`, without copying the screenshot literally.

This phase should create a native onboarding welcome experience that feels premium, playful, and consistent with the Phase 13A Pet Manager polish direction.

## Non-goals

- No full onboarding redesign beyond the greeting/welcome step unless a small structural change is required to keep navigation coherent.
- No Agent Setup, Settings, or Pet Manager changes.
- No copying the screenshot pixel-for-pixel.
- No using the screenshot as the final UI background.
- No remote image loading.
- No new onboarding business logic.
- No new pet install/configuration behavior.

## User-visible/manual outcome

On first launch, the onboarding welcome screen should feel like a real product greeting:

- clear OpenPets identity,
- friendly “AI coding companion” positioning,
- playful pet/mascot atmosphere,
- strong primary Next action,
- subtle progress dots,
- polished copy that is not generic placeholder text.

## Acceptance criteria

- Onboarding step 0 has a polished greeting layout inspired by `lfs/greeting.png` but implemented as native HTML/CSS.
- The welcome copy is concise and product-quality; avoid awkward/generic wording.
- The greeting uses available local assets only. Current discovered local assets are:
  - `apps/desktop/assets/default-pet-spritesheet.webp`
  - `apps/desktop/assets/tray-icon.png`
  - `lfs/greeting.png` as reference only, not packaged directly unless explicitly approved.
- The implemented greeting may use extracted local WebP assets copied from `web/public` into `apps/desktop/assets/`:
  - `apps/desktop/assets/onboarding-logo.webp` from `web/public/openpets.webp`
  - `apps/desktop/assets/onboarding-pets.webp` from `web/public/petland.webp`
- `lfs/greeting.png` must not appear in runtime code, packaged assets, CSS URLs, or CSP assumptions.
- Packaged image assets must be embedded as data URLs generated from local packaged files; onboarding CSP must remain `img-src data:` with no remote or `file:` image sources.
- If a hero image/illustration is needed, use a safe local packaged asset or a CSS/native composition; do not fetch remote images.
- Onboarding CSP remains restrictive; no remote image/script/style sources.
- Dynamic text continues to use DOM APIs/textContent in preload.
- Existing onboarding steps still work: Welcome → Pets → Agents → Ready → Finish.
- Existing onboarding buttons still work.
- Window remains usable at current task-window size and does not require custom native titlebar/window controls.
- Greeting fits in the increased 900×760 default task window without clipping the primary action, and remains usable at the 720×520 minimum window size.
- Keyboard/tab access still reaches Next and later Finish controls.
- Progress dots/steps still communicate the current step accessibly.
- `pnpm --filter @open-pets/desktop build` passes.
- `pnpm --filter @open-pets/desktop test` passes.
- If any runtime asset is added/referenced, `pnpm package:desktop:dir` passes or packaged asset loading is otherwise verified.
- If shared task-window styles are touched, Pet Manager, Settings, and Agent Setup are manually checked for obvious visual regressions.
- Designer review is completed before manual verification.
- Oracle implementation review is completed and feedback is dispositioned.

## Proposed files/directories

- `apps/desktop/src/windows.ts`
  - Update onboarding welcome markup and onboarding-specific scoped styles.
  - Keep styles under `body[data-openpets-view="onboarding"]` where possible.
- `apps/desktop/preload.cjs`
  - Keep existing step navigation; adjust only if new welcome markup needs small class/state handling.
- `apps/desktop/assets/`
  - Add `onboarding-logo.webp` and `onboarding-pets.webp` if using the real WebP greeting assets. Do not package `lfs/greeting.png` as-is.
- `docs/phases/phase-13b-onboarding-greeting-polish.md`
  - This phase spec, reviews, and dispositions.

## Technical approach

1. Use `lfs/greeting.png` as art direction, not implementation:
   - light airy background,
   - pixel/game feel,
   - strong OpenPets brand block,
   - mascot/pet visual area,
   - progress dots and primary Next button.
   - The file must remain reference-only and should not be copied into `apps/desktop/assets` or loaded by the app.
2. Build native onboarding welcome UI:
   - Keep the existing task window shell and Electron titlebar.
   - Use scoped onboarding CSS for the welcome step.
   - Use bundled local WebP assets when they materially improve fidelity to the reference.
   - Generate data URLs from packaged local asset files in the main process before creating the onboarding data URL, avoiding fragile `data:` document → `file:` image loading.
3. Copy direction, not copy text:
   - Proposed headline direction: “Your AI coding companion” or similar.
   - Proposed body direction: “OpenPets lives in your tray and gives your coding agents a friendly desktop companion.”
   - Keep copy short and human.
4. Preserve onboarding flow:
   - Step indicators still reflect current step.
   - Next continues to Pets.
   - Existing later steps remain functional even if visually less polished for now.
5. Preserve security:
   - No remote images.
   - If local packaged image assets are used, onboarding CSP must include only `img-src data:` and no remote or `file:` image sources.
   - No `innerHTML` for dynamic text.
   - Keep CSP restrictive.

## Risks and tradeoffs

- A single polished greeting may make later onboarding steps feel less polished. Acceptable for this phase; the goal is to confirm the welcome styling direction first.
- Using `lfs/greeting.png` directly would be fast but wrong for product UI: it includes screenshot/window chrome and fixed text. Build native UI instead.
- Without additional uploaded hero art, the visual will be inspired rather than identical. If user provides separated logo/mascot/scene assets later, a follow-up can swap them in.
- Data-URL task windows plus local file assets are easy to break in packaged apps. If assets are used, embed them as data URLs generated from packaged local files and verify package output.

## Security/privacy notes

- No remote asset loading.
- No user data or agent configuration is changed by this phase.
- Onboarding completion semantics stay unchanged.
- Renderer remains sandboxed/context-isolated through the existing task-window setup.

## Test/check plan

Run:

```bash
pnpm --filter @open-pets/desktop build
pnpm --filter @open-pets/desktop test
```

If shared task-window styles are changed unexpectedly, also run:

```bash
pnpm check
```

If runtime image assets are added or referenced, also run:

```bash
pnpm package:desktop:dir
```

## Manual verification guide

Manual verification is provided after implementation. It should include:

1. Run `pnpm dev:desktop`.
2. Reset onboarding state if needed by deleting the logged OpenPets app data state file/directory.
3. Confirm the first onboarding screen looks like a polished greeting inspired by `lfs/greeting.png`, not a literal screenshot paste.
4. Confirm copy feels good and not awkward.
5. Confirm the primary action is visible and not clipped at the default task-window size.
6. Confirm keyboard tab order reaches Next and later Finish controls.
7. Confirm progress dots/steps still show the current step clearly.
8. Confirm Next advances to Pets, then Agents, then Ready.
9. Confirm Finish still completes onboarding.
10. If shared styles changed, quickly inspect Pet Manager, Settings, and Agent Setup for obvious visual regressions.

## Oracle plan review

Reviewed by Oracle.

Blockers: none.

Should-fix feedback:

- Clarify that `lfs/greeting.png` is reference-only and must not appear in runtime code, packaged assets, CSS URLs, or CSP assumptions.
- Clarify asset strategy and CSP requirements if existing local packaged assets are used.
- Add package/manual verification if runtime assets are added or referenced.
- Add shared-style regression criteria because `createTaskWindowStyles()` is shared.
- Add fit/accessibility checks for default/minimum window sizes, keyboard/tab access, and progress dots/steps.

Nice-to-have feedback:

- Require designer review against the direction of `greeting.png`, not literal fidelity.
- Add a short note to `docs/mvp-validation.md` if this becomes part of first-run validation.
- Prefer CSS/native composition unless asset use is strongly justified.

Verdict: not implementation-ready until asset/CSP/package and shared-style verification requirements are tightened.

## Oracle feedback disposition

Fixed:

- Spec now states `lfs/greeting.png` is reference-only and must not be loaded or packaged.
- Local WebP assets are allowed when copied from `web/public` into desktop assets, embedded as data URLs, covered by explicit `img-src data:`, and package-verified.
- Added package validation requirement if runtime image assets are added/referenced.
- Added shared-window regression manual checks if shared styles are touched.
- Added fit/accessibility checks for default window size, keyboard access, and progress indicators.

Accepted:

- Designer review should compare against the reference direction, not literal screenshot fidelity.
- `docs/mvp-validation.md` can be updated if implementation makes onboarding greeting part of MVP validation.
- CSS/native composition is preferred unless asset use is clearly worth it.

## Designer implementation review

Reviewed by Designer after implementation.

Blockers: none.

Should-fix: none.

Nice-to-have feedback:

- Add a small transition to soften the visual jump between the light welcome step and later dark onboarding steps.

Verdict: approved. The native CSS composition captures the direction of `lfs/greeting.png` without copying the screenshot or adding asset/CSP risk.

## Designer implementation feedback disposition

Fixed:

- Added a reduced-motion-aware body color transition.

## Oracle implementation review

Reviewed by Oracle after implementation and follow-up fixes.

Initial should-fix feedback:

- Ensure hidden panels stay hidden because the welcome hero display rule appears after the generic hidden rule.
- Add `aria-current="step"` to the active progress indicator.

Final review:

Blockers: none.

Should-fix: none.

Nice-to-have feedback:

- Manually verify default-size fit and 720×520 minimum-size usability in real Electron rendering.
- Manually inspect Pet Manager, Settings, and Agent Setup because shared body/button styles changed.
- Future: replace emoji pet tokens with real brand/mascot assets if provided.

Verdict: approved for manual verification. Hidden panels are protected, progress state has `aria-current`, no runtime image/CSP risk was introduced, and scope remains limited to the onboarding welcome/greeting step.

## Oracle implementation feedback disposition

Fixed:

- Hidden onboarding panels now use `display: none !important` to avoid cascade surprises.
- Active progress indicator now receives `aria-current="step"`, removed from inactive indicators.
- Added reduced-motion guard for body transition/button transforms.

Accepted:

- Manual verification includes default-size fit and shared-window smoke checks.
- Real brand/mascot assets can replace emoji tokens in a later phase if provided.

## Asset-based implementation review

Reviewed by Designer and Oracle after switching from CSS/emoji composition to bundled WebP assets.

Designer verdict: approved.

- Blockers: none.
- Should-fix: none.
- Nice-to-have: cache generated asset data URLs so repeat onboarding opens do not synchronously reread WebP files.

Oracle verdict: approved for manual verification.

- Blockers: none.
- Should-fix: none.
- Nice-to-have: tighten CSP/package assertions, optionally assert packaged asset contents, remove/exclude `.DS_Store`, and manually launch packaged onboarding once.

## Asset-based implementation feedback disposition

Fixed:

- Increased the default task window size to 900×760 while retaining a 720×520 minimum size.
- Cached generated asset data URLs in the main process after the first read.
- Package contract now asserts the onboarding asset filenames and `img-src data:` CSP in `windows.ts`.

Accepted:

- Manual verification should check both the increased default size and minimum-size usability.
- Packaged-app launch verification is useful before release; `pnpm package:desktop:dir` already passes for this phase.
