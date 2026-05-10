# Phase 04B: Safe pet installation, removal, and default switching

## Goal

Allow users to install pets from the validated v2 catalog, set an installed pet as the default, render the selected default pet, and remove removable installed pets safely.

This phase turns the Phase 04A read-only catalog into the first real pet ownership flow:

```text
Catalog pet → safe download/install → installed state → set default → visible pet changes → remove → fallback
```

## Non-goals

- Pet update system.
- Categories/tags/favorites/ratings/popularity UI.
- CLI install command.
- MCP/local adapter IPC.
- Claude integration.
- Speech bubbles.
- First-run onboarding.
- Production packaging.
- Full animation-state engine.
- Remote preview rendering in Pet Manager.

## User-visible/manual outcome

After this phase, the user can install a catalog pet, set it as default, see the floating pet window reflect the selected pet, restart and keep the selection, remove it, and safely fall back to the built-in pet.

## Acceptance criteria

- Existing Phase 04A catalog fetch/search/read-only behavior continues to work.
- Pet Manager enables `Install` for catalog pets that are not installed.
- Installing a pet downloads only its validated catalog `zip` URL.
- Zip download uses allowed host/protocol/path rules from Phase 04A.
- Zip download has timeout and byte limits.
- Zip extraction prevents zip-slip/path traversal.
- Zip extraction rejects absolute paths, `..`, backslashes as separators, Windows drive paths, UNC paths, NUL bytes, duplicate normalized paths, case-insensitive collisions, symlinks/hardlinks, encrypted/unsupported entries, and entries that escape the temp directory.
- Zip extraction does not preserve executable permissions.
- Zip extraction never executes downloaded files.
- Install extracts into a temp directory first.
- Install validates required pet files before finalizing.
- Failed installs clean up temp files and do not update installed pet state.
- Successful install moves/copies validated files into `<userData>/pets/<petId>/`.
- Installed pet state is persisted only after install finalization succeeds.
- Install/remove/default state write failures propagate to the UI and do not report success.
- Pet Manager shows installed state after install.
- User can set an installed pet as default.
- Default pet id persists across restart.
- Floating pet window visibly reflects the selected default pet.
- If installed pet rendering fails, the app falls back to built-in pet rendering without crashing.
- User can remove installed non-built-in pets.
- Built-in pet cannot be removed.
- Removing the current default pet sets default back to built-in and refreshes the pet window.
- Remove failures leave app state consistent and understandable.
- Reinstall/overwrite of an already installed pet is not supported in Phase 04B.
- Concurrent duplicate install/remove/default actions for the same pet are prevented.
- Automated checks include zip/path safety tests.

## Required current zip shape

Phase 04B must inspect current real zips before implementation and document the exact accepted shape.

Expected current shape from existing catalog zips:

```text
<pet-id>/pet.json
<pet-id>/spritesheet.webp
```

Required install validation for Phase 04B:

- Exactly one top-level directory is allowed, or files may be normalized from a single safe top-level directory.
- `pet.json` must exist.
- `spritesheet.webp` must exist.
- `pet.json` must be valid JSON.
- `spritesheet.webp` must be present and under size limits.
- The installed pet id comes from the catalog id, not from trusting zip paths.
- Final installed directory contains only normalized `pet.json` and `spritesheet.webp`.

If real zips differ, update this section before implementation and re-check with Oracle.

## Install storage

Store installed pets under:

```text
<userData>/pets/<petId>/
```

Final installed shape for Phase 04B:

```text
<userData>/pets/<petId>/pet.json
<userData>/pets/<petId>/spritesheet.webp
```

Do not store or trust arbitrary absolute paths in app state.

State should store safe metadata and derive local paths from `userData` + safe pet id.

## Download and extraction limits

Initial limits:

```text
max zip download: 50 MB
max extracted total: 200 MB
max files: 500
max individual file: 100 MB
download timeout: 30 seconds
```

If real catalog pets require different limits, update this spec before implementation.

## URL policy

Download URL must come from a validated v2 catalog entry.

Zip URL rules:

- `https:` only.
- Host exactly `zip.openpets.dev`.
- Path starts with `/pets/`.
- No credentials.
- No custom port.
- Redirects should be rejected or manually validated before following.
- Phase 04B should reject redirects for zip downloads by default.
- Final URL must still satisfy all rules.

Install-from-fixture behavior:

- Installing from the validated fixture fallback is allowed in development because fixture entries use the same `zip.openpets.dev` URLs and URL validation rules.
- UI should not hide that the catalog source is fixture fallback.

Reinstall policy:

- If a pet is already installed, `Install` is disabled.
- Phase 04B does not overwrite/reinstall installed pets.
- A future update/reinstall flow can be designed later.

## Zip safety policy

Treat all zip entries as untrusted.

Before extraction:

- Verify zip magic/signature enough to reject obvious non-zip content.
- Use a zip library that reads central directory metadata and exposes entry types/sizes.
- Reject encrypted or unsupported archives.

For each entry:

- Normalize separators.
- Reject `\` as path separator in entry names.
- Reject NUL bytes.
- Reject absolute POSIX paths.
- Reject Windows drive paths such as `C:\...` or `C:/...`.
- Reject UNC paths such as `//server/share` or `\\server\share`.
- Reject any segment equal to `..`.
- Resolve output path against temp install directory and verify it remains inside that directory.
- Reject duplicate normalized paths.
- Reject case-insensitive path collisions.
- Reject symlinks/hardlinks/special files if exposed by the zip library.
- Reject encrypted or unsupported entries.
- Never execute files.
- Do not preserve executable permissions.
- Validate compressed and uncompressed sizes during extraction; do not trust metadata only.
- Reject extra non-directory files beyond the accepted normalized final shape: `pet.json` and `spritesheet.webp`.

Removal path safety:

- Derive removal path only from `<userData>/pets/<safePetId>`.
- Verify resolved path remains inside the pets root before deletion.
- Never remove paths from persisted state directly.

Mandatory tests/checks must cover malicious path cases.

## App state changes

Extend the existing V1 app state shape in a backward-compatible way. Do not introduce a V2 state migration in Phase 04B unless implementation proves V1 extension is insufficient.

Recommended installed pet state:

```ts
interface InstalledPetState {
  id: string;
  displayName: string;
  description?: string;
  builtIn: boolean;
  protected: boolean;
  installed: boolean;
  source?: {
    catalogVersion: 2;
    zip: string;
    preview: string;
  };
  broken?: boolean;
  brokenReason?: string;
}
```

Rules:

- Built-in pet remains always present/protected.
- Default pet id must point to an installed pet or fall back to built-in.
- Removing current default sets default to built-in before/with state update.
- If installed files are missing/corrupt on startup, mark the pet broken and fall back to built-in if needed. Do not crash.
- App state is updated only after file operations succeed.
- Broken installed pet policy: mark the pet as `broken: true`, keep it removable in Pet Manager, and fall back to built-in if it is/was the default.
- Do not auto-remove broken pets in Phase 04B.
- Persisted state should not store absolute local paths.

State operation order:

- Install: download zip → validate archive → extract to temp → validate final files → move to final directory → write state → report success.
- Install failure before state write: clean temp/final partial files and leave state unchanged.
- Remove non-default: validate derived removal path → remove installed record from state → delete files; if file deletion fails, keep state consistent and show a warning/error.
- Remove current default: update state so default falls back to built-in and installed record is removed atomically, refresh pet window, then delete files.
- Default switch: validate installed/non-broken pet → update state → refresh pet window; if state write fails, do not refresh/report success.
- Operation locks prevent install/remove/default races for the same pet id.

## Default pet rendering

Phase 04B does not need final animation engine quality.

Rendering rules:

- Built-in pet keeps current generated renderer.
- Installed default pet uses local installed `spritesheet.webp` as a static visible image inside the existing 180x180 pet window.
- Do not load remote image URLs in the pet window.
- Main process reads local installed `spritesheet.webp`, size-checks it, converts it to `data:image/webp;base64,...`, and passes that data URL into generated pet HTML.
- Pet window CSP must allow `img-src data:` and continue to deny remote content.
- Do not use broad `file://` access to `userData` in the pet renderer.
- If installed image fails, fallback to built-in generated renderer and log clearly.
- If installed image fails for the selected default, mark installed pet broken where practical and fall back to built-in rendering.
- Setting default should refresh the visible pet window immediately.

## Pet Manager UI behavior

Catalog card actions:

- Not installed: `Install`.
- Installing: disabled `Installing…`.
- Installed and not default: `Set Default`, `Remove`.
- Installed and default: disabled `Default`, `Remove` if removable.
- Built-in: disabled protected remove.

Show clear errors for install/remove failures.

Disable duplicate actions while an operation for a pet is in progress.

## Internal IPC/preload API

Extend the current narrow internal UI API:

```ts
installPet(petId: string): Promise<OpenPetsStateV1>
removePet(petId: string): Promise<OpenPetsStateV1>
setDefaultPet(petId: string): Promise<OpenPetsStateV1>
```

Rules:

- Sender must be Pet Manager.
- `petId` must be a safe known catalog/installed id.
- No generic invoke API.
- No filesystem/shell/Electron exposure.
- Main process validates all operation preconditions.

## Dependencies

Phase 04B may add a zip library only after checking current, maintained npm options.

Requirements for zip library choice:

- Works on Node/npm without Bun runtime.
- Supports safe iteration/extraction or exposes enough metadata to enforce safety policy.
- Actively maintained.
- Does not require native build steps if avoidable.

Use librarian/docs lookup before selecting the library.

Current recommendation to verify before implementation:

- Use a maintained pure-JS zip library such as `yauzl`/successor or another actively maintained package that supports lazy entry iteration and exposes entry metadata.
- Document final chosen library and rationale in this phase doc before or during implementation review.

Final Phase 04B choice:

- Use `yauzl@3.3.0` with `lazyEntries: true` and `validateEntrySizes: true`.
- Rationale: pure JavaScript, works with Node/npm without Bun or native build steps, exposes central-directory entry metadata before extraction, supports sequential entry processing, exposes compressed/uncompressed sizes, encryption flags, compression method, and external file attributes needed for fail-closed validation.
- Phase 04B extraction still applies OpenPets' own path, size, duplicate, collision, file type, and final-shape validation instead of relying only on the library defaults.

## Risks and tradeoffs

### Risk: zip extraction security bugs

Mitigation:

- Mandatory path-safety tests.
- Mandatory zip magic/central-directory checks where supported by chosen library.
- Temp extraction only.
- Fail closed on suspicious entries.
- Oracle implementation review focuses heavily on install safety.

### Risk: app state/file operation inconsistency

Mitigation:

- Update state only after final install succeeds.
- On remove, update default fallback and state in a safe order.
- Handle partial delete/orphan files by keeping app usable and showing clear state.

### Risk: rendering scope creep

Mitigation:

- Static local spritesheet preview only.
- Defer animation engine to later.

## Security/privacy notes

- No telemetry.
- No cookies/auth/accounts.
- No remote HTML.
- No script execution from downloaded pets.
- No shell command execution.
- No pet zip contents outside OpenPets userData paths.
- All downloaded files are untrusted.
- Fail closed on validation errors.

## Test/check plan

Automated checks:

```bash
pnpm check
pnpm typecheck
pnpm build
```

Phase 04B must add automated checks for:

- Safe zip path normalization.
- Rejection of traversal/absolute/Windows/UNC/NUL paths.
- Duplicate/case-insensitive collision rejection.
- Zip magic/non-zip rejection.
- Fixture/current catalog zip shape validation where practical.

## Manual verification guide

1. Run:

   ```bash
   pnpm --filter @open-pets/desktop dev
   ```

2. Open `Manage Pets...`.
3. Install a catalog pet, for example Snoopy.
4. Confirm it appears installed.
5. Set it as default.
6. Confirm floating pet visibly changes to the installed pet image.
7. Quit/restart and confirm installed/default state persists.
8. Remove the installed pet.
9. Confirm default falls back to built-in.
10. Confirm built-in cannot be removed.
11. Confirm catalog/search/settings still work.

Manual acceptance question:

```text
Does Phase 04B pass on your machine: safe install works, installed default rendering works, remove/fallback works, and built-in protection remains reliable?
```

## Oracle plan review

Oracle reviewed the initial Phase 04B spec and blocked implementation until state schema, broken pet policy, install/reinstall behavior, zip validation, removal safety, rendering strategy, and dependency choice were sharpened.

## Oracle feedback disposition

- Fixed: Chose backward-compatible V1 state extension instead of V2 migration.
- Fixed: Defined broken installed pet policy: mark broken/removable, fallback to built-in, do not auto-remove.
- Fixed: Explicitly allowed install from validated fixture fallback during development.
- Fixed: Forbid reinstall/overwrite in Phase 04B.
- Fixed: Required install/remove/default state write failures to propagate.
- Fixed: Required final installed directory to contain only `pet.json` and `spritesheet.webp`.
- Fixed: Added zip magic/central-directory validation requirement.
- Fixed: Required streaming download byte limit and timeout through full body read.
- Fixed: Added removal path safety rules.
- Fixed: Chose main-process data URL rendering with `img-src data:` CSP.
- Fixed: Required chosen zip library and rationale to be documented before/with implementation.

Implementation review disposition:

- Fixed: Open `yauzl` with `strictFileNames: true` so backslash entries are rejected before extraction instead of normalized.
- Fixed: App state writes now write the candidate state to disk before mutating in-memory state, preventing state/disk divergence on write failure.
- Fixed: Persisted installed pet ids are revalidated during normalization; invalid entries are dropped.
- Fixed: Startup normalization marks installed pets broken when required local files are missing/corrupt and falls back to built-in if the persisted default is broken.
- Fixed: Zip checks now include duplicate/case-collision entry sets, non-zip magic rejection, empty path segment rejection, and an archive-level `yauzl` `strictFileNames` backslash rejection check.
- Fixed: Remove-file deletion failures now report that state removal succeeded but local files may require manual cleanup.
- Fixed: Tightened initial zip magic acceptance to normal local-file and empty-archive signatures.
- Deferred: Broader archive-level tests for encrypted entries, unsupported compression, and symlink/special-file metadata remain valuable but are not required before manual Phase 04B verification because the implementation rejects those through entry metadata before writing file contents.
