# Phase 00: Workspace foundation and DX

## Goal

Create the fresh OpenPets 2.0 workspace foundation with excellent developer experience and Node/npm-compatible runtime behavior.

This phase should establish the project skeleton and basic commands needed for later implementation phases, without building real product features yet.

## Non-goals

This phase does not implement:

- Tray/menu app behavior.
- Floating pet windows.
- Pet rendering.
- Pet catalog browsing or installation.
- Local IPC.
- MCP tools.
- Claude detection/configuration/hooks.
- First-run onboarding.
- Packaging/release builds.

This phase should also avoid large migrations from v1. v1 remains reference material only.

## User-visible/manual outcome

After this phase, the user/developer should be able to install dependencies and run basic workspace checks from a clean v2 workspace.

Expected manual outcome:

```text
I can install dependencies, inspect the v2 workspace structure, and run basic check/build scripts without using Bun.
```

## Acceptance criteria

- A fresh v2 workspace structure exists outside `v1/`.
- v1 remains untouched except as reference material.
- Runtime and published package design is Node/npm/npx-compatible.
- Bun is not required for v2 runtime behavior.
- Development tooling is documented clearly.
- Node baseline is documented.
- Workspace boundaries exclude v1 and web app code from v2 workspace commands.
- Initial packages are protected from accidental publishing while they are skeletons.
- Basic workspace scripts exist for checking/building the initial skeleton.
- Package names align with the agreed `@open-pets/*` organization.
- The initial package/app structure supports later phases without overbuilding empty abstractions.
- The repo clearly distinguishes current v2 code from v1 reference code.

## Proposed files/directories

Create or update:

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig.base.json
.gitignore
README.md                    # if useful for v2 developer commands

apps/
  desktop/
    package.json
    tsconfig.json
    src/
      main.ts                # placeholder or minimal entry, no real tray behavior yet

packages/
  client/
    package.json
    tsconfig.json
    src/index.ts

  mcp/
    package.json
    tsconfig.json
    src/index.ts

  claude/
    package.json
    tsconfig.json
    src/index.ts

  cli/
    package.json
    tsconfig.json
    src/index.ts

  pet-format/
    package.json
    tsconfig.json
    src/index.ts

```

Important constraint:

- Do not add large placeholder systems just to fill packages.
- If a package would be purely empty and creates more maintenance than value, keep it minimal with only package metadata and a tiny exported placeholder/type needed for build checks.
- Defer `packages/shared` until there is a concrete first use. Avoid creating a dumping-ground package in Phase 00.

## Technical approach

Use pnpm workspaces for development ergonomics.

Recommended baseline:

```text
Node: 20+
Package manager: pnpm via Corepack
Module style: ESM
Build: plain TypeScript `tsc` for initial packages
```

Node 20+ is a conservative baseline with broad ecosystem support. A later phase may raise this if Electron or another dependency requires it.

Important distinction:

```text
Developer package manager: pnpm
Runtime/user interface: Node/npm/npx
```

This means:

- Contributors may run `pnpm install` and `pnpm check` during development.
- Contributors should use Corepack or an explicitly documented pnpm version from the root `packageManager` field.
- Published packages must be usable through normal Node/npm/npx flows.
- `@open-pets/mcp` should eventually support `npx -y @open-pets/mcp`.
- `@open-pets/cli` should eventually support `npx -y @open-pets/cli ...`.
- No v2 package should rely on Bun runtime APIs.

Workspace inclusion rule:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Do not include:

```text
v1/**
web/**
```

The existing `web/` app and `v1/` references must remain outside v2 workspace commands.

Package privacy rules:

- Root `package.json` is `private: true`.
- `apps/desktop` is `private: true`.
- Skeleton packages should be `private: true` during Phase 00 unless there is a concrete reason to make one publishable immediately.
- Public package names may still be reserved in package metadata, but avoid accidental publication of empty packages.

Initial scripts should be simple and predictable, for example:

```json
{
  "scripts": {
    "check": "pnpm -r check",
    "typecheck": "pnpm -r typecheck",
    "build": "pnpm -r build"
  }
}
```

Each initial package should expose minimal `check`, `typecheck`, and `build` scripts where practical.

Linting is deferred in Phase 00 unless it is trivial to add without expanding scope. TypeScript strictness is the initial code-quality gate.

Use TypeScript project configuration that can scale to multiple packages without making Phase 00 too complex.

Initial TypeScript/build convention:

- Use `type: "module"`.
- Use strict TypeScript settings.
- Use `moduleResolution` appropriate for modern Node ESM.
- Emit to `dist/`.
- Generate declarations for packages where practical.
- Use source maps where practical.
- Avoid bundlers until a later phase requires them.

Recommended package intent:

- `apps/desktop` — Electron desktop app, implemented in later phases.
- `packages/client` — local IPC client, implemented in Phase 05.
- `packages/mcp` — MCP stdio server, implemented in Phase 06.
- `packages/claude` — Claude detection/configuration/hooks package, implemented in Phases 07–08.
- `packages/cli` — explicit user-run CLI commands, implemented after core app/client behavior exists.
- `packages/pet-format` — shared pet manifest/catalog validation types, used by pet manager/catalog install phases.

Deferred package:

- `packages/shared` — defer until a concrete shared constant/type exists. Do not create it in Phase 00 by default.

Electron app note:

- `apps/desktop/src/main.ts` is compile-only placeholder code in Phase 00.
- Do not add real tray behavior, renderer framework, Electron window code, or packaging setup in Phase 00.
- Avoid adding Electron/Vite/React dependencies until Phase 01 unless needed for a minimal compile check.

## Risks and tradeoffs

### Risk: too much empty scaffolding

Creating every planned package immediately may produce fake progress and maintenance overhead.

Mitigation:

- Keep package contents minimal.
- Add only enough for workspace checks and future package boundaries.
- Do not implement fake APIs before their phase.
- Defer `packages/shared` until needed.

### Risk: pnpm confusion vs npm/npx requirement

The project may use pnpm for development while users need npm/npx compatibility.

Mitigation:

- Document the distinction clearly.
- Avoid pnpm-specific runtime assumptions.
- Keep package `bin`/publish behavior npm-compatible when those packages become real.

### Risk: v1 assumptions leaking into v2

v1 is Bun-oriented and has known broken agent configuration flows.

Mitigation:

- Do not copy v1 structure blindly.
- Treat v1 as reference only.
- Re-check docs and design before implementing each real feature phase.

### Risk: Phase 00 becomes abstract tooling work

Phase 00 should enable work, not become a tooling project.

Mitigation:

- Keep tooling minimal.
- Avoid CI/release/publishing complexity until later hardening phases.

### Risk: v2 workspace accidentally runs v1 or web commands

The repository contains existing `v1/` and `web/` folders with their own tooling. Accidentally including them in pnpm workspaces would blur boundaries and may pull Bun-era assumptions into v2.

Mitigation:

- `pnpm-workspace.yaml` includes only `apps/*` and `packages/*`.
- `v1/**` and `web/**` remain outside v2 workspace commands.

### Risk: accidental publish of skeleton packages

Early package skeletons should not be published before they are real.

Mitigation:

- Mark root, apps, and skeleton packages `private: true` in Phase 00.
- Revisit publish settings only in the phase where a package is ready for actual npm usage.

## Security/privacy notes

This phase should not introduce network behavior, local IPC, config editing, pet zip extraction, or agent hooks.

Security/privacy expectations for this phase:

- No secrets or credentials are added.
- No telemetry is added.
- No install scripts should perform surprising system changes.
- No package should require postinstall behavior for core development.
- Skeleton packages should be private to prevent accidental empty-package publication.

## Test/check plan

Automated checks:

```bash
pnpm install
pnpm check
pnpm typecheck
pnpm build
```

Expected result:

- Dependency install succeeds.
- TypeScript/workspace checks pass.
- Typecheck passes under the agreed Node/ESM/strict TypeScript settings.
- Initial package builds pass or intentionally no-op with clear scripts.

If package scripts are intentionally minimal, they should still be explicit and understandable.

## Manual verification guide

After implementation, the user should verify:

1. Run dependency install:

   ```bash
   pnpm install
   ```

2. Run checks:

   ```bash
   pnpm check
   ```

3. Run typecheck:

   ```bash
   pnpm typecheck
   ```

4. Run build:

   ```bash
   pnpm build
   ```

5. Inspect that v2 code lives outside `v1/`:

   ```text
   apps/desktop
   packages/client
   packages/mcp
   packages/claude
   packages/cli
   packages/pet-format
   ```

6. Confirm no Bun command is required for v2 checks/builds.

7. Confirm `pnpm-workspace.yaml` does not include `v1/**` or `web/**`.

Manual acceptance question:

```text
Does Phase 00 pass on your machine: dependencies install, checks/typechecks/builds run, and the v2 workspace structure looks right?
```

## Oracle plan review

Oracle reviewed the Phase 00 plan and approved it with required minor revisions before implementation.

Summary of Oracle feedback:

- Tighten workspace boundary so v2 workspace excludes `v1/**` and `web/**`.
- Define Node/tooling baseline.
- Protect skeleton packages from accidental publishing.
- Clarify scripts and build conventions.
- Avoid adding Electron implementation/dependencies too early.
- Defer `packages/shared` unless immediately needed.

## Oracle feedback disposition

- Fixed: Added workspace inclusion/exclusion rule for `apps/*` and `packages/*`, excluding `v1/**` and `web/**`.
- Fixed: Added Node 20+, Corepack/pnpm, ESM, and plain TypeScript build baseline.
- Fixed: Added privacy rules for root/app/skeleton packages.
- Fixed: Added `typecheck` script expectation and deferred linting explicitly.
- Fixed: Added TypeScript/build convention notes.
- Fixed: Clarified `apps/desktop/src/main.ts` is compile-only placeholder and no tray/Electron implementation belongs in Phase 00.
- Fixed: Deferred `packages/shared` until concrete need exists.

## Oracle implementation review

Oracle reviewed the implemented Phase 00 diff after successful validation with:

```bash
pnpm install && pnpm check && pnpm typecheck && pnpm build
```

Oracle found no blocking correctness, security, or spec issues and approved Phase 00 for manual user verification.

Implementation review disposition:

- Fixed: Updated stale `docs/workflow.md` current-action wording so the workflow document remains reusable across phases.
- Deferred: README Corepack guidance can be expanded later if needed; root `packageManager` already pins pnpm.
- Deferred: Package script/tsconfig simplifications can be revisited if they become maintenance overhead.
