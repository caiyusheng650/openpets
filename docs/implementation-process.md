# OpenPets 2.0 implementation process

## Goal

OpenPets 2.0 should be implemented in clear, manually verifiable phases.

The process should optimize for:

- Great developer experience.
- Smooth incremental progress.
- Working software after each phase.
- Manual user confirmation before moving to the next numbered phase or meaningful user-visible sub-phase.
- Oracle review before implementation plans are accepted.
- Oracle review after implementation before asking the user to confirm.

This is not a big-bang implementation. Each phase should be large enough to be meaningful, but small enough that the user can manually verify the result with confidence.

## Core workflow for every phase

Each phase should follow the same loop:

1. Define the phase goal and manual acceptance criteria.
2. Scout the current codebase and relevant v1 references.
3. Check current documentation for important Electron, Node, MCP, Claude, or platform behavior when needed.
4. Draft the phase implementation plan.
5. Send the plan to Oracle for architecture/process review.
6. Fix the plan based on Oracle feedback.
7. Implement the phase.
8. Run automated checks that fit the phase.
9. Send the implemented diff to Oracle for code/maintainability review.
10. Fix actionable Oracle feedback.
11. Provide the user a concise manual verification guide.
12. Wait for user confirmation before starting the next numbered phase, or any meaningful sub-phase that changes user-visible behavior.

## Global definition of done for each phase

A phase is not done until all relevant items below are true:

- The agreed acceptance criteria for the phase are met.
- Relevant automated checks pass.
- The manual verification guide is written with exact commands, actions, and expected results.
- Known limitations are documented.
- Persistent/config-changing behavior has rollback, uninstall, or restore coverage.
- Security-sensitive changes receive explicit review.
- Oracle implementation review has been completed.
- Oracle feedback disposition is recorded: fixed, deferred, or rejected with reason.
- No unrelated refactors or silent scope expansions are included.
- The user has confirmed the phase manually before moving on.

## Oracle review packet requirements

Before implementation, the phase plan sent to Oracle should include:

- Goal.
- Non-goals.
- Files/packages expected to change.
- Architecture choices and tradeoffs.
- Security/privacy concerns.
- Automated test/check plan.
- Manual acceptance criteria.

After implementation, the diff sent to Oracle should include:

- Summary of implemented changes.
- Diff or exact changed file list.
- Test/check results.
- Known limitations.
- Deviations from the approved plan, if any.
- Specific concerns where review should focus.

## Scope-control rule

If implementation reveals that a phase is larger than expected, stop and split the phase rather than silently continuing.

Do not let Oracle feedback or discovered complexity turn one phase into a much larger phase unless the user explicitly agrees.

## Phase sizing rule

Phases should be relevant and manually testable.

Avoid phases that are too small, such as:

- Rename one file.
- Add one empty package.
- Add one isolated helper with no visible outcome.

Avoid phases that are too large, such as:

- Build all Electron, MCP, Claude, pet catalog, onboarding, and packaging in one pass.
- Implement all supported agents before Claude works end-to-end.

A good phase should produce a concrete checkpoint the user can confirm, for example:

- “I can launch the desktop app and see the tray menu.”
- “I can see and drag the default pet.”
- “Claude Code is detected correctly on my machine.”
- “Claude Code configuration preview looks correct and backups are created.”
- “A real Claude session makes the pet react.”

## Proposed implementation phases

### Phase 0: V2 workspace foundation and DX

Goal:

Create the fresh v2 workspace structure and developer workflow without building product features yet.

Acceptance criteria:

- V2 workspace exists separately from v1 reference code.
- Development uses Node-based tooling and does not require Bun at runtime.
- Basic scripts are clear and documented.
- Type checking/lint/build commands are defined.
- The package shape matches the planned `@open-pets/*` architecture.

Manual confirmation:

- User can install dependencies and run the basic workspace checks.

### Phase 1: Tray-first desktop shell

Goal:

Create the Electron desktop app shell with tray/menu behavior and task-specific placeholder windows.

Acceptance criteria:

- App launches as a tray/menu bar app.
- Tray menu matches the agreed initial menu.
- Manage Pets, Configure Agents, and Settings open placeholder windows.
- Quit exits cleanly.

Manual confirmation:

- User can launch the app, inspect tray/menu items, open placeholder windows, and quit cleanly.

### Phase 2: Default pet window foundation

Goal:

Show the bundled default pet reliably as a floating desktop companion.

Acceptance criteria:

- Bundled default pet appears on launch.
- Pet window is frameless/transparent/always-on-top where supported.
- Pet does not steal focus from the editor/terminal.
- Pet is draggable.
- Pet position is persisted.
- Show/hide default pet works from tray.
- Pause/resume all pets has visible behavior.
- Platform-specific limitations for transparency, focus, dragging, and always-on-top behavior are documented.

Manual confirmation:

- User can see, drag, hide/show, pause/resume, restart, and confirm the pet position persists.

### Phase 3: Local app state and pet manager basics

Goal:

Make pet ownership and default-pet behavior real in the app.

Acceptance criteria:

- App persists core preferences.
- Built-in pet is protected from removal.
- Pet Manager can show installed pets.
- User can set default pet among installed pets.
- Settings can control important early preferences such as speech enabled and open default pet on launch.

Manual confirmation:

- User can change default-related settings, restart app, and see preferences persist.

### Phase 4: V2 pet catalog and installation

Goal:

Support browsing and installing remote pets from the v2 catalog flow.

Acceptance criteria:

- App fetches the v2 catalog.
- Pet Manager shows catalog pets with loading/error states.
- User can install a pet from zip.
- Installed pet is validated before use.
- Zip install path prevents zip-slip/path traversal.
- Zip size/file count limits exist.
- Installation never executes scripts from downloaded pets.
- Failed installs clean up partial files.
- User can remove removable installed pets.
- User can set installed pet as default.
- App remains usable if catalog fetch fails.

Manual confirmation:

- User can install a real catalog pet, set it as default, restart, and see it work.

### Phase 5: Local IPC and `@open-pets/client`

Goal:

Create the private local control plane between adapters and the desktop app.

Acceptance criteria:

- Desktop app exposes local-only IPC.
- Discovery file is written while app is running.
- Discovery file location and permissions are documented per platform.
- Startup token/version validation exists.
- Token lifetime and stale discovery cleanup are defined.
- Local-only threat model is documented.
- `@open-pets/client` can connect and call status/say/react-style methods.
- Invalid token/version requests are rejected.

Manual confirmation:

- User/developer can run a local test command and see the pet react through IPC.

### Phase 6: `@open-pets/mcp` agent-neutral integration

Goal:

Make OpenPets usable from MCP-capable coding agents through the minimal public tool set.

Acceptance criteria:

- MCP server runs with Node/npx.
- Tools exist: `openpets_status`, `openpets_say`, `openpets_react`.
- MCP startup immediately acquires a lease and opens/shows the configured/default pet.
- `--pet` chooses target pet.
- Missing explicit pet falls back to default and reports fallback.
- If app is installed but not running, MCP attempts to launch it.
- If app is missing, MCP stays alive in degraded mode and reports clearly.
- Lease cleanup works on process exit and TTL fallback.

Manual confirmation:

- User can run MCP manually or from a supported agent and see status/say/react work.

### Phase 7: Claude Code detection and configuration

Goal:

Implement the dedicated Claude Code setup experience before full hook behavior.

Acceptance criteria:

- Agent Setup detects Claude Code on the user's machine where possible.
- Shows detected/not detected/configured/needs setup/error states.
- Shows exactly what configuration changes would be made.
- Requires confirmation before editing config.
- Creates backups before editing config.
- Config edits are idempotent.
- Config writes are atomic where practical.
- Dry-run/diff preview exists before writes.
- Backup restore behavior is defined.
- Expected Claude config paths are documented per platform.
- Doctor/check reports actionable status.
- Uninstall/remove integration path exists for changes made by OpenPets.
- Uninstall verification confirms OpenPets-managed config was removed without damaging unrelated user config.

Manual confirmation:

- User can verify Claude Code detection, preview config changes, apply setup, inspect backup behavior, run doctor, and remove integration if needed.

### Phase 8: Full Claude enhanced hooks integration

Goal:

Make Claude Code feel polished through hook-driven reactions and short safe speech.

Acceptance criteria:

- `@open-pets/claude` installs global Claude hooks safely.
- Hook events map to agreed reactions.
- Speech comes from local short message pools/templates.
- Speech is throttled/selective.
- Permission/approval cases use clear fixed messages.
- Notification hooks do not speak by default.
- Speech safety rules are enforced.
- Hooks route to active Claude MCP leases when reliable and otherwise fall back to default pet.
- Hook event contract is documented.
- Ambiguous Claude/MCP/app routing states have defined fallback behavior.

Manual confirmation:

- User runs a real Claude Code session and verifies thinking/working/testing/waiting/success/error reactions plus short safe speech.

### Phase 9: First-run onboarding end-to-end

Goal:

Connect the already-working pieces into the agreed first-run experience.

Acceptance criteria:

- First-run onboarding opens appropriately.
- Default pet appears early.
- Optional pet install step works or gracefully skips on catalog failure.
- Agent setup step uses the real Agent Setup flow.
- Done state clearly says OpenPets is ready.
- Onboarding completion persists.

Manual confirmation:

- User can reset onboarding state, run through onboarding, skip or complete steps, and confirm the app lands in a ready state.

### Phase 10: MVP hardening and packaging

Goal:

Prepare the complete Claude-focused MVP for real use.

Acceptance criteria:

- Concrete platform validation matrix is defined for macOS, Windows, and Linux.
- Packaging path is tested against the agreed validation matrix.
- App lifecycle edge cases are handled.
- IPC cleanup and stale discovery behavior are reliable.
- Pet install failure cases are understandable.
- Claude install/uninstall/doctor paths are robust.
- Core automated tests/checks pass.
- Manual MVP demo checklist passes.

Manual confirmation:

- User can install or run the packaged app and complete the full MVP demo: app launch, default pet, pet install/default change, Claude setup, real Claude reactions/speech, cleanup, quit.

## Oracle review policy

Oracle should review two things for each meaningful phase:

1. The phase plan before implementation begins.
2. The implemented diff before the user is asked for manual confirmation.

Oracle feedback should be handled as follows:

- Fix correctness, safety, maintainability, data-loss, security, and architecture issues before user confirmation.
- Discuss optional scope expansions with the user instead of silently expanding the phase.
- Record Oracle feedback disposition as fixed, deferred, or rejected with reason.
- Do not let Oracle feedback turn one phase into a much larger phase unless the user agrees.

## User confirmation policy

After implementation and Oracle fixes, the user should receive:

- What changed.
- What commands to run.
- What manual behavior to verify.
- Known limitations for this phase.
- A clear question asking whether to proceed to the next phase.

Do not proceed to the next numbered phase, or any meaningful sub-phase that changes user-visible behavior, until the user confirms the current checkpoint is acceptable.
