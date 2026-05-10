# Phase 11: MVP Closeout and Release Readiness

## Goal

Turn the current packaged OpenPets MVP into a clear, repeatable release-readiness checkpoint.

This phase should consolidate the validation work from Phase 10A-10E into one broader MVP closeout pass: document exactly what is ready, what remains unverified, how to manually validate the package, and fix any small readiness gaps found while doing that review.

## Non-goals

- No public distribution release.
- No signing, notarization, installer generation, auto-update, or publishing.
- No new agent integrations beyond the current Claude-focused MVP.
- No major UI redesign or new onboarding/product feature.
- No Windows/Linux implementation work beyond documenting unverified status and known follow-up.
- No broad refactors unless required to make existing validation reliable.

## User-visible/manual outcome

The user has one authoritative MVP readiness guide and can run one documented local package validation flow to decide whether the current macOS unpacked package is MVP-ready for local dogfooding.

If small readiness bugs are found during this pass, they are fixed in this phase. Larger items are explicitly documented as post-MVP/release follow-up instead of being silently expanded into this phase.

## Acceptance criteria

- `docs/mvp-validation.md` becomes the authoritative MVP closeout checklist rather than a Phase 10A-centric note.
- The checklist clearly separates:
  - automated validation commands,
  - macOS manual validation steps,
  - cross-platform unverified gaps,
  - signing/notarization/distribution deferrals,
  - cleanup/uninstall guidance,
  - known limitations and post-MVP follow-ups.
- The docs capture the current packaged Claude command expectations using `node` plus `app.asar.unpacked` paths.
- The docs make clear that Claude configuration can contain absolute packaged-app paths and must be replaced/removed after moving or deleting the app.
- Package validation remains local-only and does not mutate real Claude settings during automated tests.
- Any small readiness issues discovered while reviewing the validation path are fixed if they are low-risk and fit this phase.
- Any larger readiness issues are recorded as known limitations/follow-ups, not implemented silently.
- `pnpm test` passes.
- `pnpm check` passes.
- `pnpm package:desktop:dir` passes after tests/checks, so manual package validation uses fresh package output.
- Oracle implementation review is completed and feedback is dispositioned.

## Proposed files/directories

- `docs/mvp-validation.md`
  - Rework into MVP closeout/readiness guide.
- `docs/phases/phase-11-mvp-closeout-release-readiness.md`
  - This phase spec, Oracle reviews, and dispositions.
- Potentially small targeted package/test/doc files if validation reveals a contained readiness gap.

## Technical approach

1. Audit the current MVP validation doc against the current package behavior from Phase 10A-10E.
2. Reorganize `docs/mvp-validation.md` into a release-readiness structure:
   - status summary,
   - automated command checklist,
   - macOS packaged-app manual checklist,
   - Agent Setup/Claude packaged command expectations,
   - cleanup/rollback notes,
   - platform/signing limitations,
   - post-MVP follow-up list.
3. Run the full local validation commands in this order, because desktop package tests may delete `apps/desktop/dist-electron` while exercising the cleanup helper:

   ```bash
   pnpm test
   pnpm check
   pnpm package:desktop:dir
   ```

4. If validation finds small issues that are directly related to readiness clarity or package contract reliability, fix them in scope. Examples in scope:
   - documentation corrections,
   - missing package contract assertions,
   - tiny validation-script fixes that keep existing behavior unchanged.
5. If validation finds behavior bugs, cross-platform failures, signing/installer/public distribution needs, or Claude workflow changes, record them as known limitations/follow-ups or ask the user before expanding scope.
6. Send the resulting diff and validation results to Oracle for implementation review.

## Risks and tradeoffs

- A closeout pass can easily become an unbounded bug-fix phase. Scope is intentionally limited to documentation clarity and small readiness fixes.
- Cross-platform package behavior remains unverified without Windows/Linux machines. The honest MVP outcome is to document that gap, not claim support that was not tested.
- The current package is unsigned and uses absolute paths for packaged Claude commands. That is acceptable for local MVP validation but not for public distribution.
- Generated app icon quality is temporary because it is derived from a 64×64 source asset.

## Security/privacy notes

- Automated tests and package checks must keep using temp fixtures and must not modify real Claude settings or real user OpenPets state.
- MVP docs should warn users before they use Agent Setup actions that mutate Claude settings.
- Speech/privacy rules from earlier phases remain unchanged: short safe pet messages only, no code/logs/secrets/URLs/path-like content.
- Cleanup guidance should distinguish OpenPets app data from Claude configuration so users do not assume deleting the app removes agent integrations.

## Test/check plan

Run in this order:

```bash
pnpm test
pnpm check
pnpm package:desktop:dir
```

If any targeted code/test changes are made, also run the most specific affected package checks first where useful.

## Manual verification guide

Manual verification is provided after implementation. It should ask the user to run the revised `docs/mvp-validation.md` macOS checklist against the packaged app and confirm whether the MVP closeout passes locally.

The revised checklist must explicitly cover:

1. Launching the packaged app from `apps/desktop/dist-electron/`.
2. Tray icon/menu presence.
3. Default pet show/hide, pause/resume, drag, and persistence basics.
4. Onboarding presence/completion or documented reset path.
5. Pet Manager installed/catalog state rendering.
6. Settings preference toggle and restart persistence.
7. Local IPC smoke with `pnpm --filter @open-pets/client smoke:status` while the packaged app is running.
8. Agent Setup preview showing bundled `node .../app.asar.unpacked/...` commands, not unpublished `npx -y @open-pets/*` commands.
9. Claude configure/install as an optional mutating step only, with backups and remove/uninstall cleanup called out.
10. Quitting OpenPets from the tray.

## MVP scope statement

Phase 11 validates a macOS local `--dir` dogfooding checkpoint only.

The readiness guide must clearly document these prerequisites and limitations:

- `pnpm` workspace checkout is required for developer validation commands.
- Packaged Claude bundled commands require `node` on Claude's PATH.
- The package is unsigned and not notarized.
- Windows/Linux package behavior, installers, auto-update, and public distribution are unverified/deferred.
- Claude settings may contain absolute paths into the packaged app and should be replaced/removed after moving or deleting the app.
- OpenPets app data cleanup and Claude config cleanup are separate.

## Oracle plan review

Reviewed by Oracle.

Blockers: none.

Should-fix feedback:

- Run `pnpm test` and `pnpm check` before `pnpm package:desktop:dir`, because tests may delete package output.
- Bound “small readiness fixes” with examples and require deferral/user approval for larger behavior/platform/signing/Claude workflow changes.
- Make the manual checklist explicit in the spec/docs.
- Separate safe Agent Setup preview validation from optional mutating Claude configure/install steps.
- State MVP scope honestly as macOS local `--dir` dogfooding only.
- Include prerequisites and limitations: Node on PATH for Claude bundled commands, workspace/pnpm requirement, unsigned warnings, absolute Claude paths, ASAR unpacked resources.

Nice-to-have feedback:

- Add a concise readiness status table.
- Include artifact identity details such as output path, app version, date/commit/manual tester fields.
- Add cleanup/data-loss notes distinguishing OpenPets app data from Claude config.

Verdict: not implementation-ready until command-order, checklist, and scope-boundary issues are fixed.

## Oracle feedback disposition

Fixed:

- Validation command order now runs `pnpm test`, `pnpm check`, then `pnpm package:desktop:dir`.
- In-scope small readiness fixes are bounded to docs, package contract assertions, and tiny validation-script fixes; larger behavior/platform/signing/Claude workflow changes require deferral or user approval.
- Manual checklist requirements are explicit in the spec.
- Claude Agent Setup preview is separated from optional mutating Claude configure/install validation.
- MVP scope is explicitly macOS local `--dir` dogfooding only.
- Prerequisites and limitations are explicitly listed.

Accepted for implementation:

- Add readiness status table.
- Add artifact identity fields where useful.
- Add cleanup/data-loss notes distinguishing OpenPets app data from Claude config.

## Oracle implementation review

Reviewed by Oracle after implementation.

Blockers: none.

Should-fix: none.

Nice-to-have feedback:

- Add a commit/SHA field to Artifact identity when doing an actual release-readiness run.
- Add typical macOS app-data path as a convenience while keeping the logged-path guidance.

Verdict: implementation-ready for manual user verification. The docs are honest about macOS-only local `--dir` readiness, clearly separate safe vs mutating Claude steps, document absolute packaged Claude paths and cleanup/data-loss risks, and preserve the workflow gate before closing MVP readiness.

## Oracle implementation feedback disposition

Accepted:

- Commit/SHA artifact fields can be filled during an actual release-readiness run.
- Typical platform app-data paths can be added as future documentation polish; the current logged-path guidance is the source of truth and avoids platform-path drift.
