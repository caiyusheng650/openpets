import { join, resolve, sep } from "node:path";

import { app } from "electron";

export function getPetsRoot(): string {
  return join(app.getPath("userData"), "pets");
}

export function getInstalledPetDir(petId: string): string {
  assertSafePetId(petId);
  const root = getPetsRoot();
  const target = resolve(root, petId);
  assertInsideRoot(root, target);
  return target;
}

export function assertSafePetId(petId: string): void {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(petId) || petId === "builtin") {
    throw new Error(`Invalid installed pet id: ${petId}`);
  }
}

export function assertInsideRoot(root: string, target: string): void {
  const resolvedRoot = resolve(root);
  const resolvedTarget = resolve(target);

  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error("Resolved path escapes OpenPets pets directory.");
  }
}
