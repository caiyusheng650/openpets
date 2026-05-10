# Phase 10D: Package Polish and Clean Output

## Goal

Polish the desktop package metadata and make package output deterministic by cleaning stale output before each package build.

This phase targets the warnings/noise surfaced during Phase 10A-10C packaging, without taking on signing, notarization, installers, or new product features.

## Non-goals

- No code signing or notarization.
- No installer targets beyond the current `--dir` package checkpoint.
- No app icon format generation unless it is trivial and safe.
- No npm publishing.
- No auto-update.
- No changes to Claude MCP/hooks behavior.

## User-visible/manual outcome

Packaging should be cleaner and less fragile:

- desktop package metadata includes description/author fields used by packagers,
- packaging scripts remove stale `dist-electron` output before rebuilding,
- package contract checks enforce clean-output behavior and metadata presence,
- documentation notes remaining unsigned/default-icon limitations.

## Acceptance criteria

- `apps/desktop/package.json` includes package metadata expected by `electron-builder`, at minimum:
  - `description`,
  - `author`.
- Package scripts clean `apps/desktop/dist-electron` before running `electron-builder --dir`.
- Both `package` and `package:dir` clean `apps/desktop/dist-electron` before running `electron-builder` because both write that output directory.
- Cleanup uses a repository-owned helper that resolves and verifies the exact target before deleting; it does not accept path/env arguments.
- Root `pnpm package:desktop:dir` still performs a full workspace build before packaging.
- Package contract checks assert metadata presence and clean-output script behavior.
- Package contract checks verify clean-output behavior with a stale sentinel or equivalent helper contract, not only script text.
- `docs/mvp-validation.md` documents any remaining package warnings, including unsigned app and default app icon if still present.
- `pnpm test` passes.
- `pnpm check` passes.
- `pnpm package:desktop:dir` passes.

## Proposed files/directories

- `apps/desktop/package.json`
  - Add metadata and clean-output package script.
- `apps/desktop/src/check-packaging-contract.ts`
  - Assert metadata and package script behavior.
- `apps/desktop/scripts/clean-package-output.cjs`
  - Cross-platform cleanup helper for `dist-electron`.
- `docs/mvp-validation.md`
  - Update package warning notes.
- `docs/phases/phase-10d-package-polish-clean-output.md`

## Technical approach

Use only Node/pnpm commands. Add a tiny CommonJS cleanup helper instead of shell-specific `rm -rf` or brittle inline `node -e` quoting:

```text
apps/desktop/scripts/clean-package-output.cjs
```

The helper should:

1. Resolve `apps/desktop/dist-electron` relative to its own location.
2. Verify the basename is `dist-electron` and parent is the desktop package root.
3. Delete with `fs.rmSync(target, { recursive: true, force: true })`.
4. Accept no path/env overrides.

Package scripts should run the helper before `electron-builder`:

```json
"package": "pnpm build && node scripts/clean-package-output.cjs && electron-builder",
"package:dir": "pnpm build && node scripts/clean-package-output.cjs && electron-builder --dir && node dist/check-packaging-contract.js --output"
```

Do not add icon generation in this phase unless the existing PNG can be safely referenced without platform-specific conversion issues.

## Risks and tradeoffs

- Cleaning output removes previous packaged builds, which is intended for deterministic packaging.
- App icon polish may need platform-specific `.icns` / `.ico` generation; defer if not trivial.
- Metadata should not imply public distribution readiness while signing/notarization are still deferred.

## Security/privacy notes

- Cleaning only targets `apps/desktop/dist-electron`.
- Do not include user data, Claude settings, backups, or secrets.
- No changes to Claude config mutation behavior.

## Test/check plan

Run:

```bash
pnpm test
pnpm check
pnpm package:desktop:dir
```

## Manual verification guide

Manual verification is provided after implementation.

## Oracle plan review

Reviewed by Oracle.

Blockers: none.

Should-fix feedback:

- Use a real cross-platform cleanup helper instead of inline `node -e`; inline example was invalid/brittle.
- Cleanup helper must resolve and verify exact target `apps/desktop/dist-electron` before deleting, with no path/env override.
- Acceptance should verify clean behavior, not only script text.
- Clarify both `package` and `package:dir` clean output.
- Add cleanup helper path to proposed files.

Nice-to-have feedback:

- Keep icon generation deferred and document default Electron icon warning.
- Metadata should not imply public release readiness while signing/notarization are deferred.
- Avoid overly brittle full-string script assertions where possible.

Verdict: implementation-ready after cleanup helper/verification clarifications.

## Oracle feedback disposition

Fixed:

- Replaced inline cleanup approach with a dedicated helper.
- Added exact-target verification/no-override requirements.
- Added clean-behavior verification requirement.
- Clarified both package scripts clean output.
- Added helper file to proposed files.

Accepted:

- Icon generation remains deferred and will be documented as a known package warning.

## Oracle implementation review

Reviewed by Oracle after implementation.

Blockers: none.

Should-fix: none.

Nice-to-have feedback:

- Document that desktop `pnpm test` may delete `apps/desktop/dist-electron` because it exercises the cleanup helper.
- Consider making contract script assertions less exact over time; current checks are acceptable.

Verdict: implementation is sound. Cleanup is scoped/cross-platform, metadata is appropriate, docs accurately defer default icon/signing, and validation passed.

## Oracle implementation feedback disposition

Fixed:

- Added docs note that desktop package tests may remove `apps/desktop/dist-electron` while exercising the cleanup helper.

Accepted:

- Current script assertions remain as-is for now.
