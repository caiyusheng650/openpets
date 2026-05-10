# Phase 04A: V2 catalog contract and read-only Pet Manager catalog

## Goal

Establish the v2 pet catalog contract and make Pet Manager fetch, validate, cache, search, and display the catalog in read-only mode.

This phase does **not** install pets yet. It prepares the catalog foundation safely before the security-critical zip install phase.

## Non-goals

- Downloading/installing pet zips.
- Removing downloaded pets.
- Setting downloaded pets as default.
- Rendering downloaded pet sprites in the default pet window.
- CLI/MCP/Claude/onboarding/packaging.
- Categories/tags/favorites/ratings/popularity UI.

## User-visible/manual outcome

After this phase:

```text
Pet Manager shows the built-in installed pet and a searchable read-only catalog of available pets from the v2 catalog contract.
```

If catalog fetch fails, Pet Manager still works for installed/built-in pets and shows a clear catalog error.

## Blocking context from Oracle

Oracle found that the target URL is currently not available:

```text
https://openpets.dev/pets/catalog.v2.json
```

Phase 04A must therefore include making a real v2 catalog artifact available in the repository/deploy path, or explicitly add a temporary development fallback while the production endpoint is being deployed.

Updated decision for Phase 04A:

- Also create the real web artifact at `web/public/pets/catalog.v2.json` now that updating `web/` is explicitly approved.
- Update `web/scripts/sync-pets.js` so future `sync:pets` runs regenerate `catalog.v2.json`.
- Create a tracked v2-shaped development fixture under the tracked v2 workspace.
- Desktop app attempts the final production URL first.
- If production URL is unavailable, desktop app falls back only to the tracked v2-shaped fixture.
- Production deployment of `web/public/pets/catalog.v2.json` can be tested after the web app is redeployed.
- Because `web/` is root-ignored, any required web files must be force-added intentionally when committing from the root repo.

## Acceptance criteria

- Existing tray/default pet/Pet Manager/Settings behavior continues to work.
- A v2 catalog contract is defined in code with validation helpers.
- The v2 catalog artifact shape is based on real current pet metadata, not invented fields.
- A deterministic tracked v2 catalog fixture exists for local development and manual verification.
- The real web v2 catalog artifact exists at `web/public/pets/catalog.v2.json`.
- `web/scripts/sync-pets.js` regenerates the v2 catalog artifact.
- The tracked fixture is v2-shaped; no silent v1 `install.json` fallback is allowed.
- Web changes are intentionally included despite `web/` being root-ignored.
- Desktop catalog fetch validates data before use.
- Catalog fetch has loading, success, and error states.
- Catalog fetch failure does not break built-in pet behavior.
- Pet Manager shows installed local pets plus read-only catalog entries.
- Pet Manager search filters catalog pets by display name/description/id.
- Catalog entries show `Install coming in Phase 04B` or disabled install actions.
- Pet Manager does not fetch remote HTML.
- Remote preview rendering is safe or deferred. If preview rendering is included, images are fetched/validated by main process or constrained to safe image-only rendering.
- Automated checks pass.

## Catalog contract

The Phase 04A canonical v2 catalog shape is:

```ts
interface CatalogV2 {
  version: 2;
  generatedAt: string;
  pets: CatalogPetV2[];
}

interface CatalogPetV2 {
  id: string;
  displayName: string;
  description: string;
  preview: string;
  zip: string;
}
```

Do not require spritesheet `format` fields in Phase 04A unless the catalog generator can derive them from real current pet data.

Validation rules:

- `version` is `2`.
- `generatedAt` is a string.
- `pets` is an array.
- `id` matches `/^[a-z0-9][a-z0-9_-]{0,63}$/`.
- `id` must not be `builtin`; `builtin` is reserved for the protected bundled pet.
- Duplicate ids are rejected.
- `displayName`, `description`, `preview`, and `zip` are strings.
- `preview` and `zip` are `https:` URLs.
- Allowed hostnames are explicit and documented. Initial expected hosts:
  - `openpets.dev`
  - `zip.openpets.dev`
- Maximum pets: 1000.
- Maximum `id` length: 64.
- Maximum `displayName` length: 120.
- Maximum `description` length: 500.
- Maximum URL length: 2048.
- `generatedAt` must parse as a valid date.
- URL credentials are rejected.
- URLs with non-default ports are rejected.
- Catalog URL is exactly `https://openpets.dev/pets/catalog.v2.json`.
- `preview` URLs must use host `openpets.dev` and path under `/pets/`.
- `zip` URLs must use host `zip.openpets.dev` and path under `/pets/`, even though zips are not downloaded in Phase 04A.

Mapping from current web metadata to v2:

- v2 `id` = existing `installId`.
- v2 `displayName` = existing `displayName`.
- v2 `description` = existing `description` if present, otherwise `""`.
- v2 `preview` = absolute `https://openpets.dev` URL from existing `spritesheetPath`.
- v2 `zip` = absolute zip URL from existing `zipPath`.

`builtin` is reserved and rejected as a catalog pet id.

## Current metadata source

Existing useful web files:

```text
web/public/pets/manifest.json
web/public/pets/install.json
web/app/lib/pets.generated.js
web/scripts/sync-pets.js
```

Phase 04A should scout these before implementation and create both:

- a real web v2 catalog artifact from current web metadata;
- a tracked local v2 fixture for desktop fallback.

Tracked development fixture:

```text
apps/desktop/catalog.v2.fixture.json
```

Production artifact:

```text
web/public/pets/catalog.v2.json
```

Because `web/` is currently ignored by root `.gitignore` and outside the v2 pnpm workspace, web changes must be added intentionally with force-add from the root repo if committing them there.

## Desktop catalog service

Add a small catalog service in the desktop app or `packages/pet-format`:

- Fetch catalog from the target URL.
- Validate response shape.
- Normalize to a UI-safe catalog model.
- Add and track the v2 fixture at `apps/desktop/catalog.v2.fixture.json` during implementation.
- On fetch failure, load the tracked v2 fixture as a development fallback.
- Defer cache file behavior to a later phase unless implementation discovers it is trivial and safe.
- Do not store catalog cache in `openpets-state.json` in Phase 04A.
- Return UI state that clearly distinguishes live catalog, fixture fallback, cached catalog, and error.

Do not cache unvalidated catalog data.

Phase 04A catalog source precedence:

1. Remote live catalog from `https://openpets.dev/pets/catalog.v2.json`.
2. If remote fetch/validation fails, validated tracked fixture at `apps/desktop/catalog.v2.fixture.json`.
3. If fixture validation also fails, show catalog error while keeping installed/built-in pets usable.

Do not use v1 `install.json` or `manifest.json` as runtime fallback in the desktop app.

Fetch requirements:

- Main process only.
- Timeout required.
- Maximum response bytes required.
- Redirect policy required; final URL must still pass protocol/host/port/credential validation.
- Allowed hosts only.
- No cookies/auth.

## Pet Manager read-only UI

Pet Manager should show:

- Installed pets section, including built-in protected pet.
- Catalog section.
- Search input.
- Catalog loading state.
- Catalog error state.
- Catalog empty state.
- Disabled `Install` button/label for catalog pets: `Install in next phase`.

Preview policy for Phase 04A:

- Defer preview image rendering by default.
- Show text-only catalog cards/rows first.
- If preview rendering is added, it must be main-process fetched/validated/cached and rendered as `data:` with `img-src data:` CSP.
- Renderer must not directly fetch arbitrary remote previews.

Do not implement install/remove/default switching for remote catalog pets in Phase 04A.

## Security/privacy notes

This phase introduces catalog network fetch but not zip extraction.

Security expectations:

- Fetch only the catalog URL and optionally validated preview images.
- No cookies/auth/accounts.
- No telemetry.
- No remote HTML.
- No zip downloads yet.
- Catalog strings are untrusted and rendered with DOM text APIs or escaped.
- URL host/protocol validation is mandatory.
- Fail closed on invalid catalog data.
- Catalog fetch happens in the main process only.
- Renderer receives sanitized catalog UI models only.

## Test/check plan

Automated checks:

```bash
pnpm check
pnpm typecheck
pnpm build
```

Phase 04A must add a lightweight validation check that runs under `pnpm check`.

At minimum, the check should validate:

- The tracked fixture is valid v2 catalog data.
- Invalid ids are rejected.
- Duplicate ids are rejected.
- Non-https URLs are rejected.
- Disallowed hosts are rejected.
- `builtin` id is rejected.

## Manual verification guide

1. Run:

   ```bash
   pnpm --filter @open-pets/desktop dev
   ```

2. Open `Manage Pets...`.
3. Confirm built-in pet still appears as installed/default/protected.
4. Confirm catalog loading state appears.
5. Confirm catalog pets appear if the catalog source is reachable.
6. Search by pet name and confirm filtering works.
7. Confirm catalog pet install buttons/actions are disabled/read-only for Phase 04A.
8. Simulate catalog failure if practical and confirm built-in/installed pets still work with a clear error.
9. Confirm Settings and default pet behavior from Phase 03 still work.

Manual acceptance question:

```text
Does Phase 04A pass on your machine: Pet Manager shows a validated searchable read-only catalog, handles catalog failure, and preserves built-in/default pet behavior?
```

## Oracle plan review

Oracle reviewed the split Phase 04A spec and agreed the split resolves the zip/install security overreach, but blocked implementation until the catalog source/artifact story was concrete.

Summary of required Oracle feedback:

- Choose a concrete v2 catalog artifact/development source because the production endpoint currently returns 404.
- Define v2 `id` mapping from current metadata.
- Make the Phase 04A catalog schema canonical, not “ideal.”
- Use only v2-shaped fallback catalogs; no silent v1 fallback.
- Add validation bounds and exact host/protocol rules.
- Ensure catalog fetch is main-process-only with timeout/byte limits/redirect/final URL validation.
- Decide preview policy; recommended text-only/defer previews.
- Use a separate validated catalog cache file, not `openpets-state.json`.
- Make catalog validation checks mandatory under `pnpm check`.
- Do not rely on ignored untracked `web/` files.

## Oracle feedback disposition

- Fixed: Chose a tracked development fixture at `apps/desktop/catalog.v2.fixture.json`.
- Fixed: Desktop attempts production URL first and falls back only to v2-shaped fixture if unavailable.
- Fixed: Production `web/public/pets/catalog.v2.json` deployment is documented as separate unless explicitly approved.
- Fixed: Defined v2 `id = installId` mapping from current web metadata.
- Fixed: Made the Phase 04A v2 schema canonical.
- Fixed: Disallowed silent v1 fallback.
- Fixed: Added max pets/string/URL bounds, `generatedAt` validation, credential/port rejection, and explicit allowed hosts.
- Fixed: Required main-process fetch with timeout, byte limit, redirect/final URL validation.
- Fixed: Deferred preview rendering by default; renderer does not fetch remote previews.
- Fixed: Required separate validated catalog cache if caching is implemented.
- Fixed: Required catalog validation checks under `pnpm check`.
- Fixed: Clarified implementation must add and track `apps/desktop/catalog.v2.fixture.json`.
- Fixed: Clarified source precedence: remote live catalog, then validated fixture, then error.
- Fixed: Clarified field-specific URL rules for catalog, preview, and zip URLs.
- Updated: User approved updating `web/`, so Phase 04A now also creates `web/public/pets/catalog.v2.json` and updates `web/scripts/sync-pets.js`.

## Oracle implementation review

Oracle reviewed the implemented Phase 04A diff after successful validation with:

```bash
pnpm check
pnpm typecheck
pnpm build
```

Initial implementation review blocked manual verification until catalog fetch hardening was fixed:

- Redirect behavior was too permissive.
- Timeout covered only headers, not full bounded body read.
- Missing stream body fell back to unbounded `response.text()`.

Implementation review disposition:

- Fixed: Remote catalog fetch now uses `redirect: "error"`.
- Fixed: Abort timeout remains active through the full bounded body read and is cleared in `finally`.
- Fixed: Missing response stream body fails closed instead of falling back to unbounded text read.

After the user approved updating and redeploying `web/`, the implementation was extended to create the real production web catalog artifact:

- `web/scripts/sync-pets.js` now writes `catalog.v2.json`.
- `web/public/pets/catalog.v2.json` was generated from current web pet metadata.
- `https://openpets.dev/pets/catalog.v2.json` was deployed and verified to return `200 application/json` with `version: 2`.

Oracle re-reviewed the web update and approved Phase 04A for manual verification.

Manual verification disposition:

- User manually verified and approved Phase 04A.
