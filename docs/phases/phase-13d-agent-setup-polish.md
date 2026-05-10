# Phase 13D: Agent Setup Polish

## Goal

Redesign the Agent Setup window into a polished **Integrations** hub that matches the new OpenPets visual direction while preserving all existing Claude MCP and hook behavior.

The first screen is a grid of integrations. Claude is the only functional integration in this phase; future integrations are visible but inert/disabled. Claude can be quickly installed when safe, or opened into a Claude detail/configuration view.

## Non-goals

- No changes to Claude MCP command semantics.
- No changes to Claude hook install/uninstall behavior beyond UI copy/styling.
- No new persisted state or settings schema.
- No hiding command/JSON previews; they remain available for trust and manual fallback.
- No remote assets or new network calls.
- No committing real Claude settings or user data in tests.
- No functional implementation for Cursor, OpenCode, VS Code, Windsurf, or Zed in this phase.

## User-visible/manual outcome

Opening **Configure Agents** shows a polished integrations grid:

- cards for Claude, Cursor, OpenCode, VS Code, Windsurf, and Zed using bundled icons,
- quick install/configure controls on the Claude card,
- disabled/coming-soon controls on future integration cards,
- a Claude detail/configuration view reachable from the Claude card,
- command/MCP JSON previews and enhanced Claude hooks controls in the Claude detail view,
- clear status badges and warning/result copy,
- polished buttons with proper icons and visual hierarchy,
- existing actions still work: refresh, copy command, configure, replace, remove, doctor hooks, install/update hooks, uninstall hooks.

## Acceptance criteria

- Agent Setup uses a polished light UI consistent with Pet Manager and onboarding.
- Layout is usable at the current task window size and responsive at 720×520 with scrolling.
- First view is an integrations grid, not a split Claude configuration view.
- Bundled integration SVG icons from `apps/desktop/assets/integrations/` are used through data URLs.
- Claude grid quick Install only runs existing safe `configure` when `canConfigure && !busy`.
- If Claude is not directly installable (already configured, not detected, mismatched entry, busy), the card action opens Claude details instead of mutating state.
- Hook install/update is never triggered from the grid quick action; hooks remain in Claude detail with visible global-setting warning.
- Non-Claude integration cards are disabled/inert and do not make IPC calls or persist state.
- Claude status states remain accurate: detected, not detected, configured, needs setup, error.
- Hook status states remain accurate: installed, needs update, not installed, error.
- Existing enable/disable rules are preserved:
  - Configure only when `canConfigure` and not busy,
  - Replace only when `canReplace` and not busy,
  - Remove only when `canRemove` and not busy,
  - Hook uninstall disabled when hooks are not installed,
  - all relevant actions disabled while busy.
- Preview strings are inserted with DOM APIs/textContent, not `innerHTML`.
- Command and JSON previews remain selectable/copyable and never execute automatically.
- Warnings make replace/remove/global-hooks risk clear without overwhelming the page.
- Buttons use proper inline SVG icons, not ASCII symbols.
- Exact CSP/asset policy is explicit:
  - if no images are used, keep the current restrictive CSP without `img-src`,
  - if bundled logos/icons are used, allow only `img-src data:`,
  - do not allow `https://openpets.dev`, broad `https:`, `file:`, `*`, remote fonts, or remote assets in Agent Setup.
- Replace, Remove, Hook Install/Update, and Hook Uninstall keep visible risk copy and require an explicit user click.
- The global Claude hooks warning remains visible near hook actions because hooks modify user-level Claude settings.
- Command-mode behavior is preserved: packaged builds remain forced to bundled mode by existing validation, and UI polish must not allow packaged users to switch to local/published mode or bypass mode validation.
- Inline SVG icons are created through static markup or DOM `createElementNS`; no `innerHTML` for icons or dynamic labels.
- Action result/status copy is exposed in a visible status region so busy/result changes are understandable.
- `pnpm --filter @open-pets/desktop build` passes.
- `pnpm --filter @open-pets/desktop test` passes.
- Designer review is completed for visual polish.
- Oracle implementation review is completed and feedback is dispositioned.

## Proposed files/directories

- `apps/desktop/src/windows.ts`
  - Replace Agent Setup markup with integrations hub plus Claude detail structure.
  - Add scoped Agent Setup CSS under `body[data-openpets-view="agent-setup"]`.
- `apps/desktop/preload.cjs`
  - Render status classes, mode controls, button icons, and preview copy into the new structure.
  - Preserve existing IPC calls and action binding behavior.
- `docs/phases/phase-13d-agent-setup-polish.md`
  - This spec, reviews, and dispositions.

## Technical approach

1. Keep `agent-setup.ts` business logic unchanged.
2. Build an integrations shell:
   - `.integrations-view`: logo/title plus integration card grid,
   - `.claude-detail-view`: Claude status, pet routing, command mode, MCP actions, previews, hooks, and back navigation.
3. In preload:
   - map `status.state` and `hookStatus.status` to CSS classes,
   - render action buttons with inline SVG icons,
   - keep `textContent` for all dynamic status/details/previews,
   - keep current button disable logic.
4. Make mode selection clear:
   - Packaged/published command is visually primary/recommended in normal use,
   - Local dev remains a checkbox/toggle only when available,
   - Packaged mode copy explains `node` PATH requirement when relevant.
5. Make preview pane stable:
   - fixed-height code panes with internal scroll,
   - no layout jumps when preview text changes.

## Risks and tradeoffs

- This page touches trusted Claude configuration actions; visual polish must not reduce clarity about side effects.
- Hook settings are global for the Claude user, so the UI must keep that warning visible.
- Too much hiding of command/JSON preview would reduce trust; keep previews visible but visually secondary.
- Button icons improve scannability but labels remain required for clarity.

## Security/privacy notes

- No new execution paths.
- No new remote content.
- No `innerHTML`.
- If using the bundled logo, CSP is `img-src data:` only for Agent Setup.
- Existing output sanitization and path redaction remain in `agent-setup.ts`.
- Existing Claude settings backup behavior remains unchanged.
- Existing IPC sender allow-list remains unchanged.

## Test/check plan

Run:

```bash
pnpm --filter @open-pets/desktop build
pnpm --filter @open-pets/desktop test
```

If Agent Setup CSP/assets/package contracts change, also run:

```bash
pnpm package:desktop:dir
```

If shared task-window styles are changed broadly, also run:

```bash
pnpm check
```

## Manual verification guide

1. Run `pnpm dev:desktop`.
2. Open Configure Agents from the tray.
3. Confirm the page looks consistent with Pet Manager polish.
4. Confirm Claude status, details, and available actions render clearly.
5. Toggle local dev mode if available and confirm previews update.
6. Change pet routing and confirm command/JSON previews update.
7. Copy command and confirm result text updates.
8. Run Refresh/Doctor and confirm status refreshes.
9. If safe on your machine, verify Configure/Replace/Remove still respect existing enable/disable states and confirmation intent.
10. Verify hook Doctor/Install/Uninstall buttons preserve current behavior and warnings remain visible.
11. Verify status variants where possible:
    - Claude not detected,
    - needs setup,
    - configured,
    - mismatched existing entry / Replace available,
    - Remove available,
    - hook installed,
    - hook needs update,
    - hook not installed,
    - hook error.
12. For mutation tests, use safe/temp Claude settings or confirm backups are created before changing real user settings.
13. If packaged mode is available, confirm the UI does not expose local/published mode switching and uses bundled command behavior.
14. Resize to 720×520 and confirm the window remains usable with scrolling.

## Oracle plan review

Reviewed by Oracle.

Blockers: none.

Should-fix feedback:

- Specify exact Agent Setup CSP/asset policy: no images means current CSP; bundled logo means `img-src data:` only; no remote assets or copied Pet Manager preview CSP.
- Tighten trust UX for destructive/global actions: Replace, Remove, Hook Install/Update, and Hook Uninstall keep visible risk copy and require explicit click; hook global warning remains visible.
- Preserve command-mode behavior: packaged app remains forced to bundled mode, dev can toggle local/published only through existing validation.
- Inline SVG icons must not use `innerHTML`; use static markup or DOM `createElementNS`.
- Expand manual verification for status variants and safe/temp Claude settings.

Nice-to-have feedback:

- Consider wider Agent Setup sizing if two columns/previews feel cramped.
- Add `aria-live`/status styling criteria for action result and busy states.
- Run `pnpm package:desktop:dir` if CSP/assets/package contracts change.

Verdict: directionally sound after these clarifications; proceed with implementation after disposition.

## Oracle feedback disposition

Fixed:

- Added exact CSP/asset policy and disallowed remote Agent Setup assets.
- Added explicit trust UX criteria for Replace/Remove/hook actions and global hook warning placement.
- Added command-mode preservation criteria for packaged vs dev behavior.
- Added no-`innerHTML` icon requirement.
- Expanded manual verification matrix.
- Added package validation requirement when CSP/assets/package contracts change.

Accepted:

- Consider Agent Setup-specific sizing during implementation if 900×760 is cramped.
- Add visible status/result region and styling for busy/result changes.

## Integrations hub plan update

User direction changed during implementation: Agent Setup should become an integrations page/hub, not just a Claude split-view setup page.

Oracle reviewed the updated plan.

Blockers: none.

Should-fix feedback:

- Claude quick Install is narrowly defined: only existing non-destructive `configure` when `canConfigure && !busy`.
- If Claude is not directly installable, open details instead of mutating anything.
- Hook install/update remains only in Claude detail with visible global hook warning.
- Other integration cards are inert/disabled; no fake success or IPC calls.
- Agent Setup CSP remains `img-src data:` only; package contract should cover bundled SVG assets and no remote Agent Setup image sources.
- No `innerHTML`; use static shell/DOM APIs.
- Update docs for grid-first integrations hub and Claude-only functional scope.

Disposition: fixed in this updated spec and implementation plan.

## Implementation review

Reviewed by Designer and Oracle after implementation.

Validation passed:

```bash
pnpm --filter @open-pets/desktop build
pnpm --filter @open-pets/desktop test
pnpm package:desktop:dir
```

Designer verdict: approved.

Designer should-fix feedback:

- Add accessible labels/live updates for command, MCP JSON, and hooks preview regions because they update when pet routing or command mode changes.

Oracle verdict: approved.

Oracle should-fix feedback: none.

Oracle nice-to-have feedback:

- Tighten the packaging contract Agent Setup CSP assertion to specifically check `createAgentSetupHtml`.
- Consider hiding/rewording disabled local dev mode in packaged builds later.

Integrations hub follow-up review:

- Designer verdict: approved. Nice-to-have: focus management and view transition polish.
- Oracle verdict: approved. Nice-to-have: after Claude quick Install, surface result in detail view; broaden package-contract remote-asset assertion.

## Implementation feedback disposition

Fixed:

- Added `aria-label` and `aria-live="polite"` to command, MCP JSON, and hooks preview regions.
- Tightened the package contract to assert Agent Setup's data-only CSP within `createAgentSetupHtml` specifically.
- Added grid → Claude detail → back focus management.
- Claude grid quick Install now opens Claude detail after configure so the action result is visible.
- Tightened package contract to reject any `https?:` reference inside `createAgentSetupHtml` and added bundled integration SVG safety checks.

Accepted:

- Packaged-build local dev mode copy can be refined later; existing command-mode validation and disabled state preserve safety.
- View transition polish can wait until the hub/detail interaction is manually reviewed.

## Claude detail redesign update

User feedback after manual review: the Claude detail page was too dense and confusing, and mismatched/custom `openpets` MCP entries should not appear as scary errors by default.

Updated UX direction:

- Claude detail is a single-column page with three clear areas:
  - **Connection**: status, pet routing, and only the actions that apply now.
  - **Optional Claude hooks**: hook status/actions with a global-settings warning.
  - **Advanced details**: collapsed command/MCP JSON/hooks JSON previews for inspection/manual fallback.
- Existing/custom `openpets` MCP entries are treated as installed-but-custom/installed-but-unverified in the UI.
- `configure` still refuses to overwrite existing custom/unverified entries; `replace` remains explicit and separate.
- Remove and hook actions stay visible only in the Claude detail view, never from the grid quick action.

Review results:

- Designer approved the simplified single-column detail flow with no blockers or should-fix issues.
- Oracle approved safety/correctness with one should-fix: bundled-mode custom-entry warning must mention that Remove deletes the `openpets` MCP entry.

Disposition:

- Fixed bundled-mode warning copy to mention Remove risk.
- Calmed the backend `configure` refusal message for existing custom/unverified entries while preserving overwrite protection.

Validation passed after fixes:

```bash
pnpm --filter @open-pets/desktop build
pnpm --filter @open-pets/desktop test
```

## Claude detail loading/action refinement

User feedback after manual review:

- Custom config repair should be a primary action labeled **Replace configuration**.
- MCP command/JSON preview belongs inside the Connection/MCP section.
- Hooks JSON preview belongs inside the Hooks section.
- Slow actions need immediate loading feedback; replace/remove/hook install/check/remove take several seconds.

Implemented:

- Renamed and promoted Replace to a primary **Replace configuration** button.
- Moved MCP advanced preview into the Connection card.
- Moved hooks advanced preview into the Hooks card.
- Added per-action loading labels/spinner and disabled surrounding controls while Claude actions run.

Review results:

- Designer approved with no blockers or should-fix issues.
- Oracle found two loading-state should-fix issues: copy command should not leave controls disabled, and failed actions must restore prior disabled states instead of blindly enabling everything.

Disposition:

- Copy command now bypasses the busy wrapper.
- Busy handling now stores/restores prior disabled states on failure.

Follow-up fixes:

- Back to integrations remains enabled while a Claude action is loading.
- Claude MCP status detection now allows a slower cold `claude mcp list` by using a longer timeout and retrying once after an initial timeout, so first open is less likely to show a transient timeout error that Refresh immediately fixes.
