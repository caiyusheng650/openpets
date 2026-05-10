# Phase 18 — Reaction Sprite Animation Mapping

## Goal

Make OpenPets reactions actually drive the pet spritesheet animation state, not just temporary reaction bubble text.

OpenPets currently uses the universal Codex/OpenPets spritesheet layout for `idle`, `run-right`, and `run-left` only. The missing piece is mapping **all** universal spritesheet rows to reachable reaction/emotion states so no available Codex animation row is unused.

This phase should make hooks like `thinking`, `editing`, `testing`, `waiting`, `success`, `error`, and `notification/attention` visibly animate the pet using the correct spritesheet rows for all built-in, installed catalog, and imported Codex pets that use the shared spritesheet format.

## Non-goals

- No new sprite art generation.
- No remote runtime art fetch.
- No broad pet format redesign.
- No new public MCP tools.
- No broad agent hook redesign. A narrow hook/reaction adjustment is allowed if needed to make every universal spritesheet row reachable.
- No physics/drag architecture rewrite beyond preserving existing drag left/right behavior.
- No support for arbitrary custom spritesheet layouts without explicit future metadata.

## User-visible/manual outcome

When Claude or MCP sends a reaction, the pet visibly changes animation row:

- prompt/thinking shows the thinking/review animation,
- edit/write activity shows an active work animation,
- bash test activity shows a waiting/testing animation,
- permission requests show waiting,
- notifications/attention can wave,
- successful completion jumps/celebrates,
- failures show the failed/error animation,
- dragging still uses left/right run animations.

Speech bubbles still work, but they are no longer the only visible feedback.

## Acceptance criteria

- A single universal spritesheet contract is documented and encoded in desktop code:
  - 1536×1872 WebP,
  - 8 columns × 9 rows,
  - 192×208 frames,
  - rows matching the Codex/OpenPets state layout below.
- The desktop renderer supports these universal rows:

  | Universal row | Codex state | Frames | Duration | Intended use |
  | --- | --- | --- | --- | --- |
  | 0 | `idle` | 6 | 5500ms | Neutral idle. |
  | 1 | `running-right` | 8 | 1060ms | Drag/move right. |
  | 2 | `running-left` | 8 | 1060ms | Drag/move left. |
  | 3 | `waving` | 4 | 700ms | Friendly attention/click/optional greeting. |
  | 4 | `jumping` | 5 | 840ms | Success/celebration. |
  | 5 | `failed` | 8 | 1220ms | Error/failure/warning. |
  | 6 | `waiting` | 6 | 1010ms | Waiting/permission/testing if no dedicated testing row. |
  | 7 | `running` | 6 | 820ms | Working/editing/running active work. |
  | 8 | `review` | 6 | 1030ms | Thinking/reviewing. |

- Every universal animation row is reachable either through drag, hook behavior, or a public reaction value:

  | Universal state | Reachability requirement |
  | --- | --- |
  | `idle` | Default/no active reaction, and message-only speech. |
  | `running-right` | Drag/move right via existing `run-right` motion IPC. |
  | `running-left` | Drag/move left via existing `run-left` motion IPC. |
  | `waving` | Reachable through a `waving` reaction and used for Claude `Notification`/attention. |
  | `jumping` | Reachable through `success` and `celebrating`. |
  | `failed` | Reachable through `error`. |
  | `waiting` | Reachable through `waiting` and `testing`. |
  | `running` | Reachable through `working`, `editing`, and `running`. |
  | `review` | Reachable through `thinking`. |

- Public reaction values should be expanded only as needed to make universal rows properly addressable:
  - add `waving` so row 3 is directly usable,
  - keep `warning` out of this phase because it maps to `failed` and does not unlock a new row,
  - do not add `sleeping` in this phase because the universal sheet has no unique sleeping row and v1 maps it to `idle`.
- Current and new OpenPets reactions map to universal spritesheet states:

  | Reaction | Spritesheet state |
  | --- | --- |
  | `idle` | `idle` |
  | `thinking` | `review` |
  | `working` | `running` |
  | `editing` | `running` |
  | `running` | `running` |
  | `testing` | `waiting` |
  | `waiting` | `waiting` |
  | `waving` | `waving` |
  | `success` | `jumping` |
  | `error` | `failed` |
  | `celebrating` | `jumping` |

- Claude hook reactions are updated only where needed for row reachability:
  - `Notification` maps to `waving` instead of `waiting`, because notification is an attention event and row 3 must be used,
  - `PermissionRequest` remains `waiting`, because permission is a blocking/waiting state.

- Drag motion remains higher-priority while dragging:
  - the existing motion IPC values stay `run-right` and `run-left`,
  - `run-right` maps to universal spritesheet state `running-right`,
  - `run-left` maps to universal spritesheet state `running-left`,
  - stopping drag returns to the current reaction state if one is active, otherwise idle.
- Reaction-only calls no longer only show the reaction word in a bubble; they also switch the sprite animation for the transient display lifetime.
- Message + reaction calls show the message in the bubble while still switching sprite animation to the reaction-mapped row.
- Message-only calls show the message while the sprite remains idle unless drag motion overrides it.
- One-shot states (`waving`, `jumping`, `failed`) run 2 loops and then stop instead of repeating for the full 4-second bubble lifetime.
- Long-running states (`idle`, `waiting`, `running`, `review`, `running-left`, `running-right`) keep looping while active.
- Hook speech still displays safe short text, but the paired hook reaction controls the animation row.
- Built-in/prefilled speech text must use consistent sentence-style capitalization. The first letter should be uppercase, and the phrase should read as a short proper sentence/status, not a mix of lowercase/title-case styles.
- All installed pets, imported Codex pets, and the built-in default pet use the same universal mapping.
- If an installed pet is missing or invalid, existing broken/fallback behavior remains unchanged.
- `prefers-reduced-motion` still disables sprite animation loops where practical.
- Tests/contract checks cover:
  - universal row constants,
  - exhaustive `reactionToSpriteState satisfies Record<OpenPetsReaction, UniversalSpriteState>` mapping,
  - every universal row has at least one reachable trigger,
  - `waving` is accepted by desktop IPC, the client protocol, and MCP `openpets_react`,
  - Claude `Notification` maps to `waving`,
  - built-in hook speech pools use consistent sentence-style capitalization, with every phrase matching at least `^[A-Z]`,
  - derived universal spritesheet dimensions equal `frameWidth * columns = 1536` and `frameHeight * rows = 1872`,
  - generated HTML/CSS includes all mapped reaction states for both `.sprite` and `.installed-sprite`,
  - existing `run-left`/`run-right` motion states still override reaction state and map to `running-left`/`running-right`,
  - reduced-motion selectors cover both built-in and installed sprite elements,
  - `docs/mapping.md` is updated to no longer claim reactions are bubble-only.

## Proposed files/directories

- `apps/desktop/src/pet-window.ts`
  - Add universal spritesheet state constants for all nine rows.
  - Add reaction-to-sprite-state mapping.
  - Render CSS selectors for reaction animation states, not only motion states.
  - Preserve drag left/right motion publisher behavior.
- `apps/desktop/pet-preload.cjs`
  - If needed, extend the existing narrow bridge to handle reaction state separately from drag motion state.
- `apps/desktop/src/default-pet-controller.ts`
  - Ensure transient reaction state survives refresh/reload and clears after `transientDisplayMs`.
- `apps/desktop/src/agent-pet-controller.ts`
  - Same for explicit/agent pet windows.
- `apps/desktop/src/check-packaging-contract.ts` or a new focused check file
  - Add mapping/contract assertions and wire the focused check into `apps/desktop/package.json` `test` if new.
- `packages/client/src/protocol.ts` and `apps/desktop/src/local-ipc-protocol.ts`
  - Add `waving` to allowed reactions so the waving row is reachable.
- `packages/claude/src/hooks.ts`
  - Map Claude `Notification` to `waving` instead of `waiting`.
- `packages/claude/src/hook-messages.ts`
  - Normalize all prefilled hook speech capitalization.
- `packages/mcp/src/tools.ts`
  - Verify MCP reaction schema exposes any newly allowed reaction values.
- `docs/mapping.md`
  - Update from “bubble-only” behavior to the new animation mapping.
- `docs/phases/phase-18-reaction-sprite-animation-mapping.md`
  - This spec, Oracle review, and feedback disposition.

## Technical approach

1. **Make the spritesheet contract explicit in code.**
   - Replace the current partial `defaultPetSprite.states` with a universal constant matching the Codex/OpenPets v1 mapping.
   - Use clear names: `idle`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, `running`, `review`.
   - Keep frame sizes/columns/rows unchanged.
   - This phase assumes all installed catalog/Codex pets are known-good universal-format spritesheets; it does **not** add WebP dimension parsing/validation. Future arbitrary pet formats should add strict metadata/dimension validation in a separate phase.

2. **Separate sprite state from bubble text.**
   - `PetTransientDisplay` already has `reaction?: string` and `message?: string`.
   - Narrow `PetTransientDisplay.reaction` to `OpenPetsReaction` if practical; otherwise validate/fallback unknown strings to `idle` before mapping.
   - Continue showing explicit `message` text when provided.
   - For reaction-only events, show a stable randomized short status line from a dedicated reaction message pool instead of the raw lowercase reaction id.
   - Additionally derive a sprite state from `reaction`.
   - If no reaction is active, sprite state is `idle` unless drag motion overrides it.

3. **Make all rows reachable.**
   - Add `waving` as an allowed reaction so row 3 is available through `openpets_react` and hook notifications.
   - Remap Claude `Notification` from `waiting` to `waving`, document it in `docs/mapping.md`, and update Claude hook tests.
   - Do not add fake use of `sleeping`; it has no unique universal row.
   - Do not add `warning`; it does not unlock a new sprite row.

4. **Normalize built-in speech text.**
   - All prefilled hook speech in `hook-messages.ts` should start with an uppercase letter and use consistent short sentence/status style.
   - Add a direct test over all hook speech pools requiring every phrase to match at least `^[A-Z]`.
   - Examples should be like `Thinking it through`, `Approval needed`, `Something failed`, not a mixed set of lowercase/title-case fragments.

5. **Render data attributes for both reaction state and drag motion.**
   - Use something like:

     ```html
     <html data-reaction-state="review" data-motion-state="idle">
     ```

   - Prefer keeping `pet-preload.cjs` motion-only. Initialize reaction state in generated HTML with `data-reaction-state` or CSS variables.
   - CSS chooses drag state when `data-motion-state` is `run-left`/`run-right`; otherwise it uses reaction state.
   - If preload must handle reaction state, it must whitelist valid universal sprite states and ignore anything else.

6. **Preserve existing drag behavior.**
   - Keep main-process movement detection because `-webkit-app-region: drag` makes renderer pointer events unreliable.
   - Do not regress the previous fix where explicit pets animate while dragged.
   - Drag should temporarily override reaction animation, then settle back to reaction state until the transient display clears.

7. **Keep transient lifetime unchanged.**
   - Reaction/message display still clears after 4 seconds.
   - When it clears, animation returns to idle unless the pet is being dragged.

8. **Use universal mapping for every pet path.**
   - Built-in fallback spritesheet and installed pet spritesheets use the same renderer code path or same generated CSS rules.
   - Codex-imported pets are already installed as `spritesheet.webp`; no separate Codex code path should be required.

9. **Update docs and tests.**
   - Update `docs/mapping.md` so it reflects the new truth.
   - Add a contract check that would fail if reactions remain bubble-only.
   - Add concrete checks against the generated CSS/source so built-in and installed pet paths cannot drift.

## Risks and tradeoffs

- The universal mapping assumes all current catalog/Codex pets share the Codex/OpenPets 8×9 layout. This is a product decision for now; arbitrary future pet formats need metadata and validation in a later phase.
- Because this phase does not parse WebP dimensions, a malformed manually-installed spritesheet can still render incorrectly; existing missing/oversized-file protections remain the safety boundary.
- `testing -> waiting` is imperfect but follows the existing v1 universal mapping. We can later add distinct test art only if the spritesheet contract changes.
- Success/error animations are temporary and will clear after 4 seconds. This is consistent with current transient display behavior, but if users expect success/error to persist longer, that should be a separate product decision.
- CSS selector precedence between drag state and reaction state must be simple and tested to avoid subtle bugs.
- Reloading pet HTML to change transient display is simple but can restart sprite animation. That is acceptable for this phase unless visual flicker is severe.

## Security/privacy notes

- No new external input is trusted beyond existing validated reaction/message values.
- Message safety rules remain unchanged.
- Renderer remains sandboxed/context-isolated with strict CSP.
- No remote script or image fetch is added.
- Installed pet file validation remains unchanged; this phase only changes how already-installed spritesheets are animated.

## Test/check plan

Run focused checks during implementation:

```bash
pnpm --filter @open-pets/desktop build
pnpm --filter @open-pets/desktop test
pnpm --filter @open-pets/claude test
pnpm --filter @open-pets/mcp test
```

If shared reaction constants move or are added to a shared package, also run affected package build/tests.

Before implementation review, run at least:

```bash
pnpm --filter @open-pets/desktop build
pnpm --filter @open-pets/desktop test
```

## Manual verification guide

After implementation:

1. Run `pnpm dev:desktop`.
2. Show the default pet.
3. Trigger each MCP reaction and confirm animation row changes visibly. Use available smoke commands if present, for example `pnpm --filter @open-pets/client smoke:react thinking`; otherwise trigger through Claude MCP tools:
   - `thinking` -> review/thinking row,
   - `working` -> active running/work row,
   - `editing` -> active running/work row,
   - `running` -> active running/work row,
   - `testing` -> waiting row,
   - `waiting` -> waiting row,
   - `waving` -> waving row,
   - `success` -> jumping row,
   - `error` -> failed row,
   - `celebrating` -> jumping row.
4. Trigger Claude `Notification`; confirm the pet waves on both default and project/agent pets, and confirm any generated text is properly capitalized.
5. Trigger `openpets_say` with both a message and reaction; confirm bubble shows the message while sprite uses the reaction animation. Also trigger message-only speech and confirm the bubble appears while the sprite stays idle.
6. Drag the pet left/right while a reaction is active; confirm drag overrides to `running-left`/`running-right`, then returns to the active reaction until it clears.
7. Set an installed/Codex pet as default and repeat representative reactions (`thinking`, `success`, `error`, `waving`).
8. Configure a project pet and confirm explicit/non-default pet reactions animate too.
9. Verify reactions clear back to idle after about 4 seconds.
10. Review all built-in/hook-generated speech phrases and confirm they start with uppercase letters and use a consistent short sentence/status style.

## Oracle plan review

Reviewed by Oracle.

Blockers: none.

Should-fix feedback:

- Clarify universal sprite state naming versus existing motion IPC names (`run-left`/`run-right`).
- Require exhaustive typed reaction-to-sprite mapping and safe fallback if `PetTransientDisplay.reaction` remains a string.
- Clarify that this phase assumes known-good universal spritesheets and does not add WebP dimension validation.
- Make the test harness concrete and wire any new check into desktop `test`.
- Ensure built-in and installed sprite CSS paths both get all mapped states.
- Cover reduced-motion behavior for installed sprites as well as built-in sprites.
- Specify message-only behavior.
- Prefer keeping the preload motion-only; if expanded, whitelist reaction states.
- Fix the “Phase 18/previous fix” typo.

Follow-up review after user requested all rows reachable and speech capitalization:

- Make `Notification` → `waving` non-optional.
- Keep `warning` out of scope because it does not unlock a new row.
- Add protocol-level acceptance criteria for `waving` across desktop IPC, client, and MCP.
- Make speech capitalization test precise: all hook speech pool phrases should start with `[A-Z]`.
- Assert derived universal spritesheet dimensions equal `1536×1872`.

Nice-to-have feedback:

- Factor universal constants/CSS generation to avoid drift.
- Add concrete smoke-command manual verification examples.
- Consider future WebP dimension checks if non-universal pets become possible.
- Document `waving` as defined but currently unused unless deliberately added.

## Oracle feedback disposition

Fixed:

- Added explicit naming guidance: motion IPC remains `run-left`/`run-right`, mapped to universal rows `running-left`/`running-right`.
- Added exhaustive typed mapping acceptance criterion using `Record<OpenPetsReaction, UniversalSpriteState>`.
- Clarified validation scope: no WebP dimension parsing in this phase; known-good universal catalog/Codex format is assumed.
- Required concrete desktop contract check wiring if a new check file is added.
- Required generated CSS/source checks for both `.sprite` and `.installed-sprite`.
- Added reduced-motion coverage for installed sprite elements.
- Added message-only behavior criterion.
- Added preference to keep preload motion-only; any reaction preload handling must whitelist state values.
- Fixed the “Phase 18/previous fix” wording.
- Made `Notification` → `waving` explicit and required.
- Kept `warning` out of scope.
- Added protocol/MCP acceptance criteria for `waving`.
- Added precise hook speech capitalization test requirement.
- Added derived spritesheet dimension assertion requirement.

Accepted:

- Implementation should factor constants/CSS generation where practical to avoid drift.
- Manual verification now includes concrete `smoke:react` examples where available.
- Future WebP dimension validation remains deferred.
- `waving` is now explicitly used by `Notification` and by public `openpets_react`.

## Oracle implementation review

Reviewed by Oracle after implementation.

Blocking feedback:

- Commit must include untracked `docs/mapping.md` because desktop packaging contract checks now require it.

Non-blocking feedback:

- Fix docs wording that still implied `waiting` covers notification.
- Clarify `openpets_react` docs so it says reactions drive animation, not only bubbles.
- Add base `background-position: 0 var(--sprite-row-y)` so reduced-motion still shows the selected reaction row instead of always showing idle.

Verdict: safe to commit after including docs and fixing the small docs/reduced-motion issues.

## Oracle implementation feedback disposition

Fixed:

- `docs/mapping.md` is part of this phase output and must be committed.
- Updated `waiting` wording in `docs/mapping.md` so notification maps to `waving` only.
- Updated `openpets_react` wording to say it drives animation and may show reaction text.
- Added base sprite `background-position` for built-in and installed sprite elements.
- Reran desktop build/test after fixes.
