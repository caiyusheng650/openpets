# OpenPets 2.0 workflow

This document defines the day-to-day working workflow for OpenPets 2.0.

The goal is to build in clear phases with excellent DX, strong review, and manual confirmation after every meaningful checkpoint.

## Source of truth documents

- `task.txt` — product decisions, agreed scope, architecture direction, and discussion history.
- `docs/implementation-process.md` — high-level implementation phases and process rules.
- `docs/workflow.md` — practical working workflow for each phase.
- `docs/phases/phase-XX-name.md` — detailed spec for one phase.

## Core rule

Do not jump straight from product notes to code.

For each implementation phase:

1. Write a dedicated phase spec in `docs/phases/`.
2. Send the phase spec to Oracle for plan review.
3. Fix or disposition Oracle feedback in the spec.
4. Ask the user to approve the phase spec.
5. Implement only the approved phase.
6. Run relevant automated checks.
7. Send the implementation diff to Oracle for code/maintainability review.
8. Fix or disposition Oracle feedback.
9. Give the user exact manual verification steps.
10. Wait for user confirmation before continuing.

## Phase spec location

Phase specs should live here:

```text
docs/phases/
```

Naming pattern:

```text
docs/phases/phase-00-workspace-foundation.md
docs/phases/phase-01-tray-desktop-shell.md
docs/phases/phase-02-default-pet-window.md
docs/phases/phase-03-local-state-pet-manager-basics.md
```

Use two-digit phase numbers so files sort naturally.

## Phase spec template

Each phase spec should use this structure:

```md
# Phase XX: Name

## Goal

## Non-goals

## User-visible/manual outcome

## Acceptance criteria

## Proposed files/directories

## Technical approach

## Risks and tradeoffs

## Security/privacy notes

## Test/check plan

## Manual verification guide

## Oracle plan review

## Oracle feedback disposition
```

The spec should be concrete enough that implementation can proceed without rediscovering the whole plan, but not so detailed that it becomes fake certainty.

## Oracle plan review packet

When sending a phase spec to Oracle for review, include:

- The phase spec path.
- The relevant product context from `task.txt` if needed.
- What decision or plan should be reviewed.
- Known uncertainties.
- Specific risks where Oracle should focus.

Oracle should review for:

- Architecture fit.
- Maintainability.
- Security/privacy issues.
- Data-loss risks.
- Cross-platform risks.
- Scope size.
- Missing acceptance criteria.
- Missing manual verification steps.

## Oracle feedback disposition

After Oracle reviews a phase spec or implementation, record feedback disposition.

Use these categories:

```text
Fixed
Deferred
Rejected
Needs user decision
```

Do not silently ignore Oracle feedback.

If feedback expands scope significantly, ask the user before expanding the phase.

## User approval before implementation

After Oracle plan review and spec updates, ask the user to approve the phase spec.

Do not start implementation until the user approves the phase spec.

The approval question should be direct:

```text
Approve Phase XX for implementation?
```

## Implementation rules

During implementation:

- Implement only the approved phase.
- Do not add unrelated refactors.
- Do not silently expand scope.
- If the phase becomes too large, stop and propose a split.
- Keep changes aligned with `task.txt`, `docs/implementation-process.md`, and the approved phase spec.
- Prefer simple, reliable, cross-platform behavior over cleverness.
- Preserve v1 as reference material only; do not blindly copy v1 assumptions.

## Implementation review packet

After implementation, send Oracle:

- Summary of implemented changes.
- Changed file list or diff summary.
- Test/check results.
- Known limitations.
- Deviations from the approved spec.
- Specific concerns where Oracle should focus.

Then fix or disposition Oracle feedback before asking the user to manually confirm.

## Manual user verification

After Oracle implementation review is resolved, give the user:

- What changed.
- Commands to run.
- Manual actions to take.
- Expected results.
- Known limitations.
- A clear confirmation question.

Example:

```text
Please verify Phase 01:

1. Run `pnpm dev:desktop`.
2. Confirm the OpenPets tray icon appears.
3. Open Manage Pets, Configure Agents, and Settings from the tray.
4. Confirm each placeholder window opens.
5. Quit from the tray and confirm the app exits cleanly.

Does Phase 01 pass on your machine?
```

Do not proceed to the next numbered phase, or any meaningful user-visible sub-phase, until the user confirms.

## Recommended initial phase sequence

Start with these phase specs:

1. `phase-00-workspace-foundation.md`
2. `phase-01-tray-desktop-shell.md`
3. `phase-02-default-pet-window.md`
4. `phase-03-local-state-pet-manager-basics.md`
5. `phase-04-v2-pet-catalog-installation.md`
6. `phase-05-local-ipc-client.md`
7. `phase-06-mcp-integration.md`
8. `phase-07-claude-detection-configuration.md`
9. `phase-08-claude-enhanced-hooks.md`
10. `phase-09-first-run-onboarding.md`
11. `phase-10-mvp-hardening-packaging.md`

Phases can be split later if they become too large.

Likely split candidates:

- Phase 04: catalog browsing vs zip install/validation.
- Phase 08: Claude hook reactions vs speech/polish.
- Phase 10: hardening vs packaging/release validation.

## Current phase tracking

Track the active phase in the relevant `docs/phases/phase-XX-name.md` file and in conversation with the user.

Do not hardcode the current next action in this workflow document; it should stay reusable across phases.
