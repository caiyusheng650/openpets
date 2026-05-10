# Phase 04: V2 pet catalog and installation

Status: superseded by split phases after Oracle review.

Oracle blocked this combined phase because the v2 catalog endpoint is not available yet and safe zip installation is security-critical enough to deserve its own focused phase.

Split replacement:

- `phase-04a-v2-catalog-read-only.md` — v2 catalog contract/generation/fetch validation and read-only searchable Pet Manager UI.
- `phase-04b-safe-pet-installation.md` — safe zip install/remove/default switching/local rendering.

## Goal

Make Pet Manager browse the remote v2 pet catalog and install/remove real downloaded pets locally, while keeping the built-in pet as protected fallback.

This phase should prove the core pet ownership loop:

```text
Fetch catalog → browse/search pets → install pet zip safely → show installed state → set default → remove removable pets
```

## Non-goals

This phase does not implement:

- Pet update system.
- Categories/tags/favorites/ratings/popularity UI.
- Advanced sorting.
- CLI install commands.
- MCP/local adapter IPC.
- Claude integration.
- Speech bubbles.
- First-run onboarding.
- Production packaging.
- Full animation/physics engine beyond rendering installed pet enough to verify default switching.

## User-visible/manual outcome

After this phase, the user/developer should be able to run the app and confirm:

```text
Pet Manager fetches the v2 catalog, shows available pets, installs a pet, lets the user set it as default, persists it across restart, and can remove removable installed pets.
```

If the catalog cannot be fetched, OpenPets should remain usable with the built-in pet and already-installed pets.

## Acceptance criteria

- Existing tray, default pet, Pet Manager, and Settings behavior continue to work.
- Pet Manager fetches catalog from:

  ```text
  https://openpets.dev/pets/catalog.v2.json
  ```

- Catalog fetch has loading and error states.
- Catalog fetch failure does not break built-in pet behavior.
- Catalog data is validated before use.
- Pet Manager shows catalog pets in a simple searchable list/grid.
- Pet Manager shows installed/default/protected states.
- User can install a catalog pet from its `zip` URL.
- Downloaded zip is validated before extraction/install.
- Zip install prevents zip-slip/path traversal.
- Zip install has size and file-count limits.
- Zip install never executes scripts from downloaded pets.
- Failed installs clean up partial files.
- Installed pets are stored locally under OpenPets user data.
- Installed pet metadata is persisted in app state.
- User can set an installed non-built-in pet as default.
- Default pet window reflects the selected default pet after setting default.
- Default pet selection persists across restart.
- User can remove removable installed pets.
- Built-in pet cannot be removed.
- Removing the current default pet falls back to the built-in pet.
- App remains usable if installed pet files are missing/corrupt; fallback to built-in pet.
- Automated checks pass.

## Proposed files/directories

Likely update:

```text
apps/desktop/src/app-state.ts
apps/desktop/src/default-pet-controller.ts
apps/desktop/src/pet-window.ts
apps/desktop/src/windows.ts
apps/desktop/preload.cjs
README.md
packages/pet-format/src/index.ts
```

Likely add:

```text
apps/desktop/src/catalog.ts
apps/desktop/src/pet-install.ts
apps/desktop/src/installed-pets.ts
apps/desktop/src/download.ts
apps/desktop/src/zip.ts
```

Exact file names can change if a simpler structure is better.

## Technical approach

Keep this phase focused on safe catalog/install basics, not marketplace polish.

### Catalog contract

Use the agreed v2 catalog URL:

```text
https://openpets.dev/pets/catalog.v2.json
```

Expected minimal catalog shape:

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
  format: {
    type: "spritesheet";
    columns: number;
    rows: number;
    frameWidth: number;
    frameHeight: number;
  };
}
```

Validation rules:

- `version` must be `2`.
- `pets` must be an array.
- `id`, `displayName`, `description`, `preview`, and `zip` must be strings.
- `id` must be a safe local identifier, for example `/^[a-z0-9][a-z0-9_-]{0,63}$/`.
- `zip` and `preview` must be `https:` URLs.
- `format.type` must be `spritesheet`.
- Format dimensions/counts must be positive finite integers within safe bounds.

Use `packages/pet-format` for shared catalog/pet types and validation helpers if practical.

### Catalog UI

Pet Manager should show:

- Search input.
- Installed pets and catalog pets in one simple view or clearly separated sections.
- Pet name.
- Short description.
- Preview image if safe/practical.
- Badges: `Built-in`, `Installed`, `Default`, `Protected`.
- Actions: `Install`, `Set Default`, `Remove`, disabled where not valid.
- Loading/error states.

Do not add categories/tags/favorites/sorting beyond search.

### Installed pet storage

Store installed pets under app user data.

Recommended directory:

```text
<userData>/pets/<petId>/
```

Installed pet state should include enough metadata to render/manage it later:

```ts
interface InstalledPetState {
  id: string;
  displayName: string;
  description?: string;
  builtIn: boolean;
  protected: boolean;
  localPath?: string;
  previewPath?: string;
  format?: CatalogPetV2["format"];
  source?: {
    catalogVersion: 2;
    zip: string;
    preview: string;
  };
}
```

The built-in pet remains a code-defined protected pet and does not need localPath.

### Zip download/install safety

This is the highest-risk part of Phase 04.

Required behavior:

- Download only `https:` zip URLs from validated catalog entries.
- Enforce max download size before/during download.
- Enforce max extracted file count.
- Enforce max individual file size and total extracted size where practical.
- Extract only into a temporary install directory first.
- Reject absolute paths.
- Reject paths containing `..` after normalization.
- Reject entries that would escape the temp install directory.
- Reject symlinks/hardlinks if zip library exposes them.
- Never execute files from downloaded pets.
- Validate required pet files/manifest before finalizing install.
- Move temp install directory into final `<userData>/pets/<petId>` atomically where practical.
- Clean temp directory on failure.

Recommended limits for initial phase:

```text
max zip download: 50 MB
max extracted total: 200 MB
max files: 500
```

These can be adjusted by implementation if real catalog pets need different limits, but the final chosen limits must be documented.

### Installed pet validation

Initial installed pet validation can be minimal but real.

Required:

- Installation directory exists.
- At least one plausible sprite/preview file exists, or the catalog `preview` was cached successfully.
- Catalog format metadata is persisted.
- Pet id/displayName in state match the validated catalog entry.

If the actual zip structure from current catalog is known to contain a manifest, validate that manifest too. Do not invent a complex new manifest requirement if current pets do not have it yet; record the discovered shape in this phase doc after implementation.

### Default pet rendering after install

Phase 04 does not need final spritesheet animation quality.

But when a user sets an installed pet as default, the default pet window should visibly reflect that choice.

Acceptable Phase 04 rendering:

- Built-in pet keeps current generated pet rendering.
- Installed pet default can show cached preview/spritesheet image in the pet window, scaled into the 180x180 pet window.
- If preview/spritesheet fails, fallback to built-in generated pet and show installed/default state in Pet Manager.

Do not build the full animation-state engine yet unless it is simpler than a static preview.

### App state updates

Extend V1 state conservatively or introduce V2 state if necessary.

Rules:

- Built-in pet must always be present and protected.
- Installed pet records are normalized on read.
- Default pet id must point to an installed pet or fallback to built-in.
- Removing current default sets default to built-in.
- State writes remain owned by `app-state.ts`.

### Internal UI IPC/preload

Extend the existing narrow internal UI API only as needed.

Candidate methods:

```ts
getCatalog(): Promise<CatalogUiState>
installPet(petId: string): Promise<OpenPetsStateV1>
removePet(petId: string): Promise<OpenPetsStateV1>
setDefaultPet(petId: string): Promise<OpenPetsStateV1>
```

Rules:

- No generic `invoke(action, payload)`.
- Validate sender window.
- Validate pet id.
- Do not expose filesystem/shell/Electron.
- Render state-derived/catalog-derived strings through DOM text APIs or HTML escaping.

## Risks and tradeoffs

### Risk: Phase 04 is too large

Catalog browsing, downloading, zip validation, install, remove, default switching, and rendering can become large.

Mitigation:

- Keep UI minimal.
- Do not add categories/tags/favorites/update system.
- If zip/install complexity becomes larger than expected, split Phase 04 into:
  1. Catalog browse/read-only.
  2. Safe install/remove/default.

### Risk: zip extraction security bugs

Zip-slip/path traversal is a real risk.

Mitigation:

- Treat all zip entries as untrusted.
- Normalize and verify every output path.
- Extract to temp directory.
- Clean up on failure.
- Oracle implementation review should focus heavily on install safety.

### Risk: unknown current pet zip structure

Current web/catalog pets may not match a clean v2 manifest structure yet.

Mitigation:

- Scout current `web/public/pets` metadata and one real zip before implementation.
- Do not blindly copy v1 assumptions.
- Keep validation compatible with real available pets while still safe.
- Record discovered zip shape in this phase doc after implementation.

### Risk: remote images/content in Electron UI

Loading remote preview URLs directly in Electron windows can expand attack surface.

Mitigation:

- Prefer fetching/caching previews through main process or use safe image-only rendering.
- Do not load arbitrary remote HTML.
- Keep CSP restrictive.
- Validate preview URL as `https:`.

## Security/privacy notes

This phase introduces network and untrusted zip handling.

Security/privacy expectations:

- Only fetch the catalog URL and validated `https:` pet assets/zips.
- No telemetry.
- No cookies/auth/accounts.
- No remote HTML content.
- No script execution from downloaded pets.
- No shell command execution.
- All downloaded zip contents are treated as untrusted.
- All catalog/download strings rendered in UI are escaped or inserted as text.
- Pet install writes only under OpenPets user data paths.
- Fail closed on validation errors.

## Test/check plan

Automated checks:

```bash
pnpm check
pnpm typecheck
pnpm build
```

Manual app run command:

```bash
pnpm --filter @open-pets/desktop dev
```

Implementation should add unit-style tests for pure validation/path-safety helpers if a lightweight test approach is practical in this phase. If no test framework is added, document why and rely on manual verification plus Oracle review.

## Manual verification guide

After implementation, the user should verify:

1. Start the desktop app:

   ```bash
   pnpm --filter @open-pets/desktop dev
   ```

2. Open `Manage Pets...`.
3. Confirm built-in pet still appears as installed/default/protected.
4. Confirm catalog loading state appears, then catalog pets appear.
5. Search for a pet by name and confirm filtering works.
6. Install one real catalog pet.
7. Confirm it appears as installed.
8. Set the installed pet as default.
9. Confirm the default pet window visibly changes or shows that pet's preview.
10. Quit and restart; confirm installed pet and default selection persist.
11. Remove the installed pet.
12. Confirm default falls back to built-in if removed pet was default.
13. Confirm built-in pet still cannot be removed.
14. Temporarily disconnect network or block catalog fetch and confirm the app remains usable with installed/built-in pets.
15. Confirm Settings and Phase 03 preferences still work.
16. Quit OpenPets and confirm clean exit.

Manual acceptance question:

```text
Does Phase 04 pass on your machine: catalog loads, search works, a pet installs safely, default switching persists, removal works, and built-in fallback remains reliable?
```

## Oracle plan review

Pending.

## Oracle feedback disposition

Pending.
