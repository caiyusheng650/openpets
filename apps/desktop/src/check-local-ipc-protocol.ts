import { errorResponse, maxIpcMessageBytes, parseIpcRequest, validateReaction, validateSayMessage } from "./local-ipc-protocol.js";

const token = "test-token";
const valid = {
  id: "1",
  version: 1,
  token,
  method: "status",
  params: {},
};

parseIpcRequest(JSON.stringify(valid), token);
parseIpcRequest(JSON.stringify({ ...valid, method: "pets.list" }), token);
assertRejects(() => parseIpcRequest(JSON.stringify({ ...valid, token: "bad" }), token));
assertRejects(() => parseIpcRequest(JSON.stringify({ ...valid, version: 2 }), token));
assertRejects(() => parseIpcRequest(JSON.stringify({ ...valid, method: "pet.install" }), token));
assertRejects(() => parseIpcRequest("not json", token));

validateReaction("testing");
validateReaction("waving");
assertRejects(() => validateReaction("bad"));

validateSayMessage("Working on it");
for (const unsafe of [
  "",
  "a".repeat(141),
  "line one\nline two",
  "```code```",
  "const secret = 1",
  "https://example.com",
  "/Users/alvin/project/file.ts",
  "api_key=abc123",
]) {
  assertRejects(() => validateSayMessage(unsafe));
}

if (Buffer.byteLength(JSON.stringify({ message: "x".repeat(maxIpcMessageBytes) }), "utf8") <= maxIpcMessageBytes) {
  throw new Error("Oversized fixture was not oversized.");
}

const response = errorResponse("1", new Error("boom"));
if (response.ok || response.error?.code !== "internal_error") {
  throw new Error("Failed to create structured error response.");
}

console.log("Local IPC protocol validation passed.");

function assertRejects(callback: () => unknown): void {
  try {
    callback();
  } catch {
    return;
  }
  throw new Error("Expected validation to reject.");
}
