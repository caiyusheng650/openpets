import assert from "node:assert/strict";

import { canInlineCodexPreview, maxCodexPets, maxCodexPreviewBytes, maxCodexTotalPreviewBytes, validateCodexPetMetadata } from "./codex-pets-core.js";

const valid = validateCodexPetMetadata({
  id: "fixer",
  displayName: " Fixer ",
  description: " Repairs things. ",
  spritesheetPath: "spritesheet.webp",
}, "fixer");

assert.deepEqual(valid, {
  id: "fixer",
  displayName: "Fixer",
  description: "Repairs things.",
  spritesheetPath: "spritesheet.webp",
});

assert.throws(() => validateCodexPetMetadata({ id: "other", displayName: "Other", description: "Nope", spritesheetPath: "spritesheet.webp" }, "fixer"));
assert.throws(() => validateCodexPetMetadata({ id: "builtin", displayName: "Built-in", description: "Reserved", spritesheetPath: "spritesheet.webp" }, "builtin"));
assert.throws(() => validateCodexPetMetadata({ id: "bad/id", displayName: "Bad", description: "Bad", spritesheetPath: "spritesheet.webp" }, "bad/id"));
assert.throws(() => validateCodexPetMetadata({ id: "fixer", displayName: "Fixer", description: "Nope", spritesheetPath: "../spritesheet.webp" }, "fixer"));
assert.throws(() => validateCodexPetMetadata({ id: "fixer", displayName: "", description: "Nope", spritesheetPath: "spritesheet.webp" }, "fixer"));

assert.equal(canInlineCodexPreview(0), false);
assert.equal(canInlineCodexPreview(maxCodexPreviewBytes), true);
assert.equal(canInlineCodexPreview(maxCodexPreviewBytes + 1), false);
assert.equal(canInlineCodexPreview(Number.POSITIVE_INFINITY), false);
assert.equal(maxCodexTotalPreviewBytes, maxCodexPreviewBytes * 3);
assert.equal(maxCodexPets, 100);

console.error("Codex pet validation passed.");
