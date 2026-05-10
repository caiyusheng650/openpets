# Phase 10C: ASAR Runtime Packaging

## Goal

Move the desktop package from fully unpacked local-validation output to a more release-like ASAR package while keeping Claude's externally executed MCP and hook commands available as regular unpacked files.

Phase 10C should reduce package over-inclusion from Phase 10A/10B and prove the packaged app still works with bundled Claude commands.

## Non-goals

- No public signed/notarized release.
- No installer targets beyond the current `--dir` package checkpoint unless trivial.
- No npm publishing.
- No auto-update.
- No start-at-login.
- No new agent integrations.
- No changing Claude hook/MCP behavior except paths needed for ASAR packaging.

## User-visible/manual outcome

The current-platform package still builds with:

```bash
pnpm package:desktop:dir
```

The generated app uses ASAR for the Electron app contents, but still includes unpacked files that Claude can execute with external `node`:

```text
app.asar
app.asar.unpacked/node_modules/@open-pets/mcp/dist/index.js
app.asar.unpacked/node_modules/@open-pets/claude/dist/cli.js
```

Agent Setup packaged previews should point at `app.asar.unpacked/...` paths, not `app.asar/...` paths and not source checkout paths.

## Acceptance criteria

- `electron-builder` ASAR packaging is enabled.
- Externally executed bundled command files are unpacked:
  - `@open-pets/mcp/dist/index.js`,
  - `@open-pets/claude/dist/cli.js`,
  - package metadata (`package.json`) needed for ESM/package resolution,
  - all runtime files and transitive dependencies those commands need when launched by external `node`.
- Packaged Agent Setup bundled MCP preview points at a regular file outside `app.asar`, preferably under `app.asar.unpacked`.
- Packaged hook preview points at a regular file outside `app.asar`, preferably under `app.asar.unpacked`.
- Desktop runtime imports from ASAR still work for the Electron app itself.
- Package contract checks assert:
  - `app.asar` exists,
  - externally executed command entry files exist under unpacked resources,
  - unpacked command package metadata exists,
  - external `node` can execute packaged MCP/Claude command entry points in safe smoke modes,
  - generated bundled command preview paths do not contain `.asar` except `.asar.unpacked`,
  - no symlinks escape package output,
  - forbidden repo/user-data patterns remain absent.
- Runtime bundled path resolution handles both dev/unpacked and packaged ASAR layouts.
- Claude bundled path validation still rejects missing files, symlinks, and true `app.asar` paths, while allowing `app.asar.unpacked` paths.
- `docs/mvp-validation.md` is updated to describe ASAR + unpacked command resources.
- `pnpm test` passes.
- `pnpm check` passes.
- `pnpm package:desktop:dir` passes.

## Proposed files/directories

- `apps/desktop/electron-builder.yml`
  - Enable ASAR and configure unpacking for externally executed OpenPets command resources.
- `packages/claude/src/claude-code.ts`
  - Resolve bundled MCP path to ASAR-unpacked location when running from ASAR.
- `packages/claude/src/hook-settings.ts`
  - Resolve bundled Claude CLI path to ASAR-unpacked location when running from ASAR.
- `packages/claude/src/check-claude-code.ts`
  - Cover ASAR-to-unpacked path mapping.
- `packages/claude/src/check-claude-hooks.ts`
  - Cover ASAR-to-unpacked hook CLI path mapping.
- `apps/desktop/src/check-packaging-contract.ts`
  - Validate ASAR/unpacked package output and bundled command files.
- `docs/mvp-validation.md`
  - Update packaging notes.
- `docs/phases/phase-10c-asar-runtime-packaging.md`

## Technical approach

### Builder config

Enable ASAR:

```yaml
asar: true
```

Use `asarUnpack` for externally executed command resources and their module metadata/dependency closure. Initial candidate:

```yaml
asarUnpack:
  - node_modules/@open-pets/mcp/**
  - node_modules/@open-pets/claude/**
  - node_modules/@open-pets/client/**
  - node_modules/@modelcontextprotocol/**
  - node_modules/zod/**
```

If runtime smoke testing shows additional MCP SDK transitive dependencies are required for external `node`, include them. Prefer a minimal external command runtime subtree, but correctness is more important than micro-optimizing package size in this phase.

### Path mapping

When `@open-pets/claude` runs inside Electron from `app.asar`, its `import.meta.url` may include `app.asar`. Bundled command paths for Claude must map to `app.asar.unpacked`.

Add a pure, tested path mapper with behavior:

```text
.../Resources/app.asar/node_modules/@open-pets/claude/dist/index.js
=>
.../Resources/app.asar.unpacked/node_modules/@open-pets/claude/dist/cli.js
.../Resources/app.asar.unpacked/node_modules/@open-pets/mcp/dist/index.js
```

In dev/non-ASAR mode, continue resolving sibling workspace package paths as today.

Validation must reject true `app.asar` command paths but allow `app.asar.unpacked` paths.

### Validation

Package output contract should locate either:

- ASAR + `app.asar.unpacked` resources from Phase 10C.

Phase 10C should prefer ASAR and fail if `app.asar` is missing after package output.

Because forbidden-file checks cannot simply walk inside `app.asar` as a directory, use an ASAR library/tool or verify through builder file config plus unpacked tree checks.

Post-package smoke checks should execute:

```bash
node <app.asar.unpacked>/node_modules/@open-pets/mcp/dist/index.js --version
node <app.asar.unpacked>/node_modules/@open-pets/claude/dist/cli.js hook --openpets-managed
```

The hook smoke must use isolated/missing discovery input so it does not contact a real desktop app.

## Risks and tradeoffs

- **Dependency completeness:** external `node` running unpacked MCP/hook files may need dependencies that were left inside `app.asar`. Package contract and manual Claude tests must catch this.
- **Path mapping:** ASAR path rewrites are easy to get subtly wrong on Windows. Keep mapping string-based and covered by tests.
- **Package size:** unpacking command packages duplicates some files. Accept for this MVP unless it becomes excessive.
- **Future installers/signing:** signing/notarization remains deferred.

## Security/privacy notes

- Do not weaken renderer sandbox/context isolation/CSP.
- Do not include user data, Claude settings, backups, or secrets in package output.
- Claude config changes remain explicit/backup-protected.
- Externally executed command files must be shipped by OpenPets, not downloaded dynamically.

## Test/check plan

Run:

```bash
pnpm test
pnpm check
pnpm package:desktop:dir
```

Automated coverage:

- ASAR path maps to ASAR-unpacked command path.
- True `app.asar` command paths are rejected while `app.asar.unpacked` command paths are allowed.
- Package output contains `app.asar` and unpacked command resources.
- Packaged command resources are regular files, not symlinks.
- External `node` smoke-executes packaged MCP/Claude command files.

## Manual verification guide

Manual verification is provided after implementation.

## Oracle plan review 

Reviewed by Oracle.

Blockers: none.

Should-fix feedback:

- Make `asarUnpack` dependency closure explicit; external `node` cannot resolve modules left inside `app.asar`.
- Include package metadata in unpacked resources because ESM packages need `package.json`, `type`, and exports metadata.
- Add post-package smoke checks that actually run packaged MCP and Claude CLI entry points with safe inputs.
- Change validation semantics from rejecting any `.asar` to rejecting true `app.asar` while allowing `app.asar.unpacked`.
- Add pure/tested path mapper for `app.asar` → `app.asar.unpacked`, including Windows/backslash and spaces cases.
- Update package contract for ASAR-era layout: `app.asar` exists and command files are regular non-symlink files under `app.asar.unpacked`.
- If forbidden-file checks cannot walk ASAR contents, inspect ASAR with a tool/library or explicitly verify builder config plus unpacked tree checks.

Nice-to-have feedback:

- Prefer a minimal external command runtime subtree, but do not over-optimize before smoke checks pass.
- Document ASAR as packaging hygiene, not a security boundary.
- Keep installer/signing deferred.

Verdict: implementation-ready after tightening unpacked dependency/metadata and smoke-test requirements.

## Oracle feedback disposition

Fixed:

- Added explicit unpacked dependency and package metadata requirements.
- Added external node smoke-test requirements for MCP and Claude command entry points.
- Clarified validation should reject true `app.asar` but allow `app.asar.unpacked`.
- Added pure ASAR path mapper requirement and ASAR-era package contract requirements.
- Clarified forbidden-file checks must account for ASAR not being a normal directory.

Accepted:

- Keep installer/signing deferred.
- Document ASAR as packaging hygiene, not a security boundary in implementation docs.

## Oracle implementation review

Reviewed by Oracle after implementation.

Blocker:

- The ASAR-unpacked command target was mapped from `app.asar` to `app.asar.unpacked`, but the bundled validation root was still derived from `import.meta.url` under `app.asar`. Valid unpacked command paths could be rejected as outside root.

Should-fix feedback:

- Add a test for validation/root containment behavior, not only the string mapper.
- Manual packaged Agent Setup UI verification remains required.
- Consider cleaning `dist-electron` before packaging to avoid stale output masking regressions.

Nice-to-have feedback:

- Narrow `asarUnpack` later; `node_modules/**` is acceptable for MVP because command smokes prove dependency closure.
- Make `mapAsarPathToUnpacked` match `app.asar` as a path segment only.

Verdict: close, but fix ASAR containment-root issue before acceptance.

## Oracle implementation feedback disposition

Fixed:

- Bundled validation roots now pass through the same `app.asar` → `app.asar.unpacked` mapper as command target paths.
- `mapAsarPathToUnpacked` now matches `app.asar` as a path segment and leaves `app.asar.unpacked` unchanged.
- Added mapper coverage for path-segment behavior and already-covered command smoke tests validate packaged command files under `app.asar.unpacked`.

Accepted:

- `node_modules/**` remains unpacked for this MVP phase to keep external command dependency closure reliable.

Needs manual verification:

- Packaged Agent Setup UI must be manually verified after implementation.

Final Oracle re-check:

- Blockers: none.
- Remaining should-fix: none from the prior review.
- Manual packaged Agent Setup/Claude verification remains the phase gate before closing.
- Verdict: ASAR-to-unpacked path mapping and containment validation look correct; package command smokes passed; proceed to manual packaged verification.
