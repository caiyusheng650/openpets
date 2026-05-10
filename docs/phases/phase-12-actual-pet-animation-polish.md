# Phase 12: Actual Pet Animation Polish

## Goal

Replace the placeholder-feeling built-in pet experience with an actual animated pet renderer and premium compact chat bubble that feel alive in the packaged app.

This phase should make the default OpenPets experience look like a real desktop companion instead of a CSS/wireframe prototype, while preserving the stable packaging, IPC, Claude, and pet-install safety work already completed.

## Non-goals

- No public marketplace/catalog redesign.
- No signing, notarization, installer, or distribution changes.
- No new agent integrations.
- No broad Pet Manager/Agent Setup UI redesign unless needed to preview the actual pet.
- No complex physics simulation.
- No audio.
- No unvalidated remote pet format expansion that weakens install safety.

## User-visible/manual outcome

When the user launches OpenPets, the default pet appears as an actual animated sprite/visual companion, not a simple CSS mascot or static image.

The pet should:

- idle with a high-quality loop,
- switch to directional drag/move animation based on mouse drag direction,
- react visibly to pause/resume,
- show premium compact speech/reaction bubbles cleanly,
- stay transparent/framed like a desktop pet,
- remain draggable and non-disruptive,
- package correctly in the macOS local app.

## Acceptance criteria

- A real bundled default pet visual asset exists in `apps/desktop/assets/` or another packaged desktop asset location.
- Bundled pet asset contract is explicit:
  - source file: `apps/desktop/assets/default-pet-spritesheet.webp`, copied from the real catalog material for Claude (`https://zip.openpets.dev/pets/claude-f187e74a/claude.zip` / `web/public/pets/claude-f187e74a/spritesheet.webp`),
  - no remote runtime art fetch,
  - known frame layout/dimensions documented in code comments or constants: 1536×1872, 8 columns × 9 rows, 192×208 frames,
  - at minimum supports `idle`, `run-left`, and `run-right` visual states,
  - no SVG-coded/generated substitute for the default pet.
- The built-in default pet renderer uses the asset instead of the CSS-only mascot.
- The pet renderer supports at least an idle animation loop for the bundled pet.
- Dragging the pet changes animation/direction based on mouse movement:
  - dragging right uses a right-facing/running-right visual state,
  - dragging left uses a left-facing/running-left visual state,
  - stopping drag settles back to idle without jitter.
- Drag-direction detection does not rely on renderer pointer events inside `-webkit-app-region: drag`.
- Installed-pet rendering uses the same current catalog sprite contract as the built-in default pet: 1536×1872 WebP, 8 columns × 9 rows, 192×208 frames, with idle/run-right/run-left rows animated instead of showing the full spritesheet.
- Pause/resume visibly affects animation without breaking window transparency or input behavior.
- Speech/reaction bubble styling is polished enough for MVP: premium compact text, readable typography, subtle depth, clean pointer, constrained dimensions, gentle entrance/exit, not huge, not wireframe, and does not expose unsafe message content beyond existing filtering.
- Pet window sizing/clamping accounts for the actual visual asset and bubble space.
- The tray icon and packaged app icon behavior remain unchanged.
- Package contract checks cover the new bundled pet asset(s).
- Package contract checks verify the source asset exists, is non-empty, and remains covered by packaged `assets/**` inclusion.
- `pnpm test` passes.
- `pnpm check` passes.
- `pnpm package:desktop:dir` passes.
- Oracle implementation review is completed and feedback is dispositioned.

## Proposed files/directories

- `apps/desktop/assets/`
  - Add bundled default pet sprite/asset file(s).
- `apps/desktop/src/pet-window.ts`
  - Replace CSS-only built-in pet with asset-backed rendering.
  - Add animation-state CSS/JS for bundled pet.
  - Add drag-direction animation state handling driven from safe main-process window movement signals, not renderer pointer events in draggable regions.
  - Polish bubble/reaction presentation.
- `apps/desktop/pet-preload.cjs`
  - Optional narrow preload for pet windows if needed to receive main-process motion events and update DOM state without enabling Node in the renderer.
- `apps/desktop/src/built-in-pet.ts`
  - Document or reference bundled pet asset expectations if useful.
- `apps/desktop/src/display.ts`
  - Adjust default pet window sizing if the actual pet needs more space.
- `apps/desktop/src/check-packaging-contract.ts`
  - Assert bundled pet asset(s) are present and packaged.
- `docs/mvp-validation.md`
  - Update manual validation checklist to include actual animated pet quality checks.
- `docs/phases/phase-12-actual-pet-animation-polish.md`
  - This phase spec, reviews, and dispositions.

## Technical approach

1. Choose a safe MVP asset strategy:
   - Use a repository-owned bundled WebP/PNG sprite asset from the existing catalog materials.
   - Do not use SVG-coded/generated substitute art for the default pet.
   - Initial target contract: one local 1536×1872 sprite sheet with 8 columns × 9 rows, 192×208 frames, and rows/states for `idle`, `run-left`, and `run-right`.
   - Do not fetch remote art at runtime.
2. Implement asset-backed built-in pet rendering:
   - Keep the pet window sandboxed/context-isolated.
   - Keep CSP strict and allow only the needed local/data image sources (`img-src file: data:` for file-backed images).
   - If renderer-side state JS is required, prefer a narrow preload listening for whitelisted IPC messages. Do not enable Node integration, remote scripts, eval, or broad renderer privileges.
   - Preserve transparent frameless always-on-top behavior.
3. Add MVP animation:
   - Use CSS sprite/background animation or a small controlled frame loop.
   - Avoid heavy dependencies.
   - Respect pause/resume with `animation-play-state` or equivalent.
   - During drag, infer horizontal drag direction from main-process `BrowserWindow` movement deltas because Electron draggable regions do not reliably deliver renderer pointer events.
   - Send only whitelisted motion states (`idle`, `run-left`, `run-right`) to the pet renderer, via narrow preload IPC or another bounded safe bridge.
   - Use simple thresholding/debouncing so the pet does not flicker between left/right on tiny movements.
   - Return to idle after drag stops or after a short no-movement timeout.
   - Add `prefers-reduced-motion` handling where practical.
4. Polish the pet and chat bubble presentation:
   - Better shadow/depth around the pet image.
   - Speech bubble with small premium typography, constrained width/height, subtle entrance/exit, pointer styling, and layered shadow instead of harsh borders.
   - Bubble copy should feel like a compact companion status, not a toast/card: short line length, balanced wrapping, soft radius, optical alignment to the pet, and no giant empty surface.
   - Bubble content must be rendered as escaped text/textContent only, never `innerHTML` from message content.
   - Apply shared bubble styling to both built-in and installed pet windows so the default and installed experiences do not diverge badly.
   - No `transition: all`; animate specific transform/opacity properties only.
5. Preserve installed pet behavior:
   - Current installed catalog pets provide `spritesheet.webp` using the 1536×1872 / 8×9 / 192×208 contract.
   - Render installed pets through the same CSS sprite-frame approach as the built-in default pet, not as a full-sheet image.
   - Do not show a decorative fallback square/box behind valid installed pets.
   - If future metadata parsing is added, keep it strict and backward-compatible.
6. Update contract checks/docs and run full validation.

## Risks and tradeoffs

- Art quality can consume too much time. This phase should improve the default from wireframe to delightful MVP, not solve final branding.
- Sprite animation format changes can break installed pets if not backward-compatible. Phase 12 assumes the current catalog/v1 1536×1872 / 8×9 / 192×208 spritesheet contract; future custom formats need explicit validation/metadata work.
- `-webkit-app-region: drag` prevents reliable renderer pointer events. Drag animation must be driven from main-process window movement or a narrow custom drag architecture.
- Window transparency, draggable regions, and speech bubbles are platform-sensitive; keep the implementation simple and test packaged output.
- Chat bubble polish can expand into broad UI redesign. Keep scope to the pet window bubble only.
- Drag-direction animation can be jittery if based on every pointer event. Use thresholds and smoothing rather than instant direction flips.
- Larger pet/bubble sizing can move the pet unexpectedly; clamp to work area and avoid stealing focus.

## Security/privacy notes

- Bundled pet assets must be local repository assets; no runtime remote fetch.
- Installed pet safety rules remain: no script execution, zip-slip prevention, file limits, size limits.
- Speech safety rules remain unchanged: short messages only; no code/logs/secrets/URLs/path-like content.
- Renderer CSP must remain restrictive.
- Chat bubble message content must use escaped text/textContent only and must not introduce `innerHTML` injection paths.

## Test/check plan

Run:

```bash
pnpm test
pnpm check
pnpm package:desktop:dir
```

Also run focused desktop checks during implementation if package contract or pet-window code changes.

## Manual verification guide

Manual verification is provided after implementation. It should include:

1. Run `pnpm dev:desktop` and confirm the default pet is an actual animated visual, not CSS/wireframe.
2. Confirm the pet remains transparent, frameless, draggable, and non-focus-stealing.
3. Drag the pet left and right and confirm the animation/direction changes with drag direction, then settles back to idle without flicker.
4. Confirm pause/resume visibly pauses/resumes animation.
5. Trigger or inspect speech/reaction bubble behavior and confirm it feels premium: compact, readable, visually attached to the pet, no oversized wireframe card, no jarring animation.

   Suggested speech command while OpenPets is running:

   ```bash
   pnpm --filter @open-pets/client smoke:say "Working on it" thinking
   ```

   Suggested reaction command:

   ```bash
   pnpm --filter @open-pets/client smoke:react success
   ```

6. If a catalog/installed pet is available, set it as default and confirm static installed-pet rendering still works with the shared polished bubble.
7. Run `pnpm package:desktop:dir`, launch the packaged app, and repeat the default pet checks.

## Oracle plan review

Reviewed by Oracle.

Blockers:

- Drag-direction plan was not implementable as initially written because the current pet window uses `-webkit-app-region: drag`, which makes renderer pointer events unreliable, and there was no preload/IPC bridge.

Should-fix feedback:

- Define the bundled pet asset contract: filenames, format, dimensions/frame layout/states, ownership/source, and fallback behavior.
- Be explicit about CSP and avoid broad renderer scripting privileges.
- Require bubble text to use escaped text/textContent only.
- Clarify that polished bubble styling applies to installed pets too.
- Add concrete manual bubble triggers using client smoke commands.
- Add manual verification for installed-pet fallback/static rendering.
- Specify package contract checks for new assets in ASAR-era packaging.
- If changing default pet window size, verify clamping/persistence.

Nice-to-have feedback:

- Prefer CSS sprites or animated image formats over custom JS frame loops unless JS is needed for drag state.
- Add lightweight asset checks for existence, size, and dimensions if easy.
- Add `prefers-reduced-motion` support.
- Use real catalog pet material rather than generated/SVG-coded art when available.

Verdict: not implementation-ready until drag-direction architecture and asset/CSP/manual-verification requirements are tightened.

## Oracle feedback disposition

Fixed:

- Drag-direction architecture now explicitly avoids renderer pointer events in draggable regions and uses main-process window movement deltas plus a narrow safe bridge/preload if needed.
- Added bundled pet asset contract requirements, including local checked-in WebP source, known frame layout/states, and no SVG-coded/generated substitute.
- Added CSP requirements for file/data image sources and no Node integration/remote/eval/broad renderer privileges.
- Required bubble content to be escaped/text-only and shared across built-in and installed pet windows.
- Added concrete manual `smoke:say` and `smoke:react` triggers.
- Added installed-pet fallback/static rendering manual verification.
- Added package contract expectations for source asset existence/non-empty and packaged `assets/**` inclusion.
- Added clamp/persistence verification if window sizing changes.

Accepted:

- Prefer CSS sprites or animated image formats when practical.
- Add lightweight asset checks where easy.
- Add `prefers-reduced-motion` handling where practical.
- Prefer real catalog pet material over generated art.

## Oracle implementation review

Reviewed by Oracle after implementation.

Blockers: none.

Should-fix: none before manual verification.

Key checks:

- Drag-direction architecture uses main-process window movement, not renderer pointer events in `-webkit-app-region: drag`.
- Pet preload is narrow: only listens for whitelisted `openpets:pet-motion` states and mutates `dataset`.
- Renderer remains sandboxed/context-isolated with Node disabled.
- Bubble content is escaped text, not unsafe HTML.
- Installed pet fallback remains static/safe with shared bubble styling.
- Packaging config includes `pet-preload.cjs` and assets; contract checks cover source asset/preload/config.

Nice-to-have feedback:

- Add an ASAR-content/package-output assertion for `pet-preload.cjs` and `default-pet-spritesheet.webp` later if convenient.
- If manual testing shows drag jitter, tune the `3px` threshold / `180ms` idle timeout.
- Future installed-pet animation metadata remains out of Phase 12.

Verdict: implementation is acceptable for manual verification. Focus manual testing on packaged sprite loading, left/right drag animation, idle settle, bubble quality, pause/resume, installed-pet fallback, and no focus/drag regressions.

## Oracle implementation feedback disposition

Accepted:

- ASAR-content assertions can be added as future package hardening; current source/config/package validation passed.
- Additional bundled asset hygiene checks can be added if bundled pet assets become more complex.
- Drag threshold/idle timing will be tuned only if manual testing shows jitter.
- Richer installed-pet animation metadata is a future phase, not Phase 12.
