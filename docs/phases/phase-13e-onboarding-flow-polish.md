# Phase 13E: Onboarding Flow Polish

## Goal

Finish the first-run onboarding flow beyond the polished welcome screen so the Pets, Integrations, and Ready steps feel like a direct continuation of the welcome screen and guide users into the real product windows.

Phase 13B polished only the first welcome/greeting step. This phase polishes the remaining onboarding steps and makes the primary action on those steps open Pet Manager or Integrations.

## Non-goals

- No new pet installation behavior.
- No new Claude MCP or hooks behavior.
- No new persisted onboarding sub-step state.
- No remote assets or new network calls.
- No changes to runtime use of `lfs/greeting.png`; it remains reference-only.
- No committing real user data or Claude settings.

## User-visible/manual outcome

On first launch, onboarding should feel complete:

- Step 0 remains the polished OpenPets welcome.
- Step 1 explains choosing/managing pets and makes **Open Pet Manager** the primary action.
- Step 2 explains connecting coding agents and makes **Open Integrations** the primary action.
- Step 3 clearly explains that setup is done and where to reopen Pet Manager/Integrations later.
- The user can still skip/continue without installing a pet or configuring Claude.
- Pets/Integrations step copy makes focus behavior clear: if the user opens the product window, they should return to onboarding to continue.

## Acceptance criteria

- Onboarding still has four clear steps: Welcome, Pets, Integrations, Ready.
- Later steps use the same light polished visual language as the welcome/Pet Manager/Integrations work, not the older dark generic card style.
- Onboarding does not auto-open Pet Manager or Integrations on step entry.
- Open Pet Manager and Open Integrations are primary actions; Continue remains secondary beside them.
- If Pet Manager or Integrations is already open, clicking the primary action reuses/focuses the existing window through the existing `openTaskWindow` behavior and does not create duplicates.
- Manual open is best-effort: if a window open fails, onboarding shows a readable status/error and the primary button remains usable.
- Each open step has a dedicated status line with clear states: instruction text, `Opening…`, `Opened — return here to continue.`, and failure text.
- Manual buttons remain available:
  - Open Pet Manager / Continue,
  - Open Integrations / Continue,
  - Start using OpenPets,
  - optional Ready-step shortcuts.
- Step labels/copy/buttons use current product naming: “Integrations” rather than “Agent Setup” everywhere user-facing. Internal IPC/function names may remain unchanged.
- Onboarding completion behavior remains unchanged: Finish marks onboarding completed and closes the onboarding window.
- Closing onboarding before Finish still leaves onboarding incomplete and available later.
- Auto-opening Pet Manager/Integrations does not mutate pet catalog, Claude MCP config, or hook settings by itself.
- Existing IPC sender allow-list remains local-only and only allows onboarding to open internal task windows.
- Onboarding CSP remains `img-src data:` only; no remote assets.
- Dynamic text/status updates use DOM APIs/textContent, not `innerHTML`.
- Keyboard/tab access still reaches all actions.
- Window remains usable at 900×760 and 720×520 with scrolling if needed.
- `pnpm --filter @open-pets/desktop build` passes.
- `pnpm --filter @open-pets/desktop test` passes.
- Designer review is completed for the polished later-step UX.
- Oracle implementation review is completed and feedback is dispositioned.

## Proposed files/directories

- `apps/desktop/src/windows.ts`
  - Update onboarding markup and scoped styles for Pets, Integrations, Ready steps.
  - Rename visible Agent Setup copy to Integrations where appropriate.
- `apps/desktop/preload.cjs`
  - Trigger one-time Pet Manager/Integrations auto-open when entering steps 1 and 2.
  - Keep manual buttons and completion behavior.
- `apps/desktop/src/check-packaging-contract.ts`
  - Update assertions only if onboarding contract/copy/assets need coverage.
- `docs/phases/phase-13e-onboarding-flow-polish.md`
  - This spec, reviews, and dispositions.

## Technical approach

1. Keep the existing four-step onboarding model.
2. Replace the older dark generic card markup for steps 1–3 with polished light cards:
   - Pets: short explanation, “Pet Manager opened” status, Open/Continue actions.
   - Integrations: short explanation, “Integrations opened” status, Open/Continue actions.
   - Ready: clear final call-to-action and shortcuts.
3. In preload, keep `showStep(step)` focused on navigation only; do not auto-open child windows.
4. Clicking Open Pet Manager calls `onboardingApi.openPetManager()` and updates a dedicated status line.
5. Clicking Open Integrations calls `onboardingApi.openAgentSetup()` and updates a dedicated status line.
6. Continue buttons advance without opening windows.
7. Do not make open actions install/configure anything; they only open internal windows.

## Risks and tradeoffs

- Opening child windows can steal focus from onboarding. This now only happens after an explicit user click on the primary action.
- Onboarding step copy/status must explicitly say that the product window opened and the user should return to onboarding to continue.
- Pet Manager/Integrations are separate task windows, so users may need to return to onboarding manually after reviewing them. The onboarding copy should make that clear.

## Security/privacy notes

- No new external IPC or network behavior.
- Auto-open only calls existing internal window-opening IPC from the onboarding renderer.
- No automatic Claude configuration, hook installation, pet installation, file writes, or user settings mutation beyond final onboarding completion.
- Existing CSP restrictions remain.

## Test/check plan

Run:

```bash
pnpm --filter @open-pets/desktop build
pnpm --filter @open-pets/desktop test
```

If onboarding CSP/assets/package contracts change, also run:

```bash
pnpm package:desktop:dir
```

## Manual verification guide

1. Run `pnpm dev:desktop`.
2. Reset onboarding state if needed by deleting the OpenPets app data directory.
3. Confirm Welcome still looks polished.
4. Click Next and confirm Pet Manager does not auto-open.
5. Confirm the Pets step visually matches the welcome screen direction and has Open Pet Manager as the primary action with Continue secondary beside it.
6. Click Open Pet Manager and confirm it opens/focuses Pet Manager and updates the status line.
7. Return to onboarding and click Continue; confirm Integrations does not auto-open.
8. Confirm the Integrations step visually matches the welcome screen direction and has Open Integrations as the primary action with Continue secondary beside it.
9. Click Open Integrations and confirm it opens/focuses Integrations and updates the status line.
10. Confirm neither auto-open action installs pets, configures Claude, installs hooks, or removes anything.
11. Confirm Ready step copy and shortcuts are clear.
12. Click Start using OpenPets and confirm onboarding closes and does not reopen on next launch.
13. Confirm closing before Finish keeps onboarding incomplete.
14. Resize to 720×520 and confirm all steps remain usable.

## Oracle plan review

Reviewed by Oracle.

Blockers: none.

Should-fix feedback:

- Clarify focus/window behavior because auto-open will likely steal focus from onboarding.
- Define once-only semantics precisely: entering steps repeatedly should not reopen/refocus unless the user clicks the manual button.
- Require dedicated status lines for `Opening…`, success, and failure.
- Rename visible Agent Setup copy to Integrations; internal names may stay.
- Confirm auto-open only happens after user advances, not on initial welcome render.
- Add manual verification for existing-window reuse/focus without duplicates.

Nice-to-have feedback:

- Add a return-to-onboarding hint in step copy.
- Add package-contract assertions if CSP/copy/assets change materially.
- Manually check small displays and multi-window behavior.

Verdict: implementation-ready after tightening focus/status/once-only criteria.

## Oracle feedback disposition

Fixed:

- Added focus-stealing/return-to-onboarding copy requirements.
- Defined once-only semantics per onboarding renderer session and manual button behavior.
- Added dedicated auto-open status line requirements.
- Required user-facing Integrations naming.
- Clarified no auto-open on initial welcome render.
- Expanded manual verification for reuse/focus/no duplicates.

Accepted:

- Package-contract assertions are only needed if CSP/assets/contracts materially change.
- Small display and multi-window behavior are included in manual verification.

## Revised UX direction

After an initial implementation pass, user feedback was that auto-open felt wrong and later steps did not visually match the first welcome page closely enough.

Updated direction:

- Do not auto-open Pet Manager or Integrations on step entry.
- Make **Open Pet Manager** / **Open Integrations** the primary action.
- Keep **Continue** as the secondary action next to the primary action.
- Ensure the later onboarding cards use the same light background, rounded glass card, clouds, typography, and visual direction as the welcome screen.

## Implementation notes

Implemented:

- Reworked Pets, Integrations, and Ready steps into polished light cards.
- Renamed user-facing Agent Setup copy/buttons to Integrations.
- Added dedicated auto-open status lines for Pet Manager and Integrations.
- Added one-time auto-open behavior for steps 1 and 2 after user navigation.
- Preserved manual open buttons and finish behavior.

Validation/reviews pending.
