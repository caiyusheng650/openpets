import { existsSync, lstatSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

import { isRecord, maxIpcMessageBytes, openPetsIpcProtocol, openPetsIpcVersion, OpenPetsClientError } from "./protocol.js";

export interface OpenPetsDiscoveryFile {
  readonly protocolVersion: 1;
  readonly protocol: "openpets-ipc";
  readonly endpoint: string;
  readonly token: string;
  readonly appVersion: string;
  readonly pid: number;
  readonly platform: NodeJS.Platform;
}

export function getDiscoveryFilePath(): string {
  if (process.env.OPENPETS_DISCOVERY_FILE) {
    return process.env.OPENPETS_DISCOVERY_FILE;
  }

  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "OpenPets", "runtime", "ipc.json");
  }

  if (process.platform === "win32") {
    return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "OpenPets", "runtime", "ipc.json");
  }

  const xdg = getSecureXdgRuntimeDir();
  if (xdg) {
    return join(xdg, "openpets", "ipc.json");
  }

  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "OpenPets", "runtime", "ipc.json");
}

export function readDiscoveryFile(path = getDiscoveryFilePath()): OpenPetsDiscoveryFile {
  let raw: string;
  try {
    const stat = statSync(path);
    if (!stat.isFile()) throw new OpenPetsClientError("invalid_discovery", "OpenPets discovery path is not a file.");
    if (stat.size > maxIpcMessageBytes) throw new OpenPetsClientError("invalid_discovery", "OpenPets discovery file is too large.");
    raw = readFileSync(path, "utf8");
  } catch (error) {
    if (error instanceof OpenPetsClientError) throw error;
    throw new OpenPetsClientError("unavailable", `OpenPets discovery file is unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  if (Buffer.byteLength(raw, "utf8") > maxIpcMessageBytes) {
    throw new OpenPetsClientError("invalid_discovery", "OpenPets discovery file is too large.");
  }

  try {
    return validateDiscovery(JSON.parse(raw) as unknown);
  } catch (error) {
    if (error instanceof OpenPetsClientError) throw error;
    throw new OpenPetsClientError("invalid_discovery", "OpenPets discovery file is malformed JSON.");
  }
}

export function validateDiscovery(value: unknown): OpenPetsDiscoveryFile {
  if (!isRecord(value)) throw new OpenPetsClientError("invalid_discovery", "Discovery must be an object.");
  if (value.protocol !== openPetsIpcProtocol) throw new OpenPetsClientError("invalid_discovery", "Discovery protocol is invalid.");
  if (value.protocolVersion !== openPetsIpcVersion) throw new OpenPetsClientError("invalid_discovery", "Discovery protocol version is invalid.");
  if (value.platform !== process.platform) throw new OpenPetsClientError("invalid_discovery", "Discovery platform does not match this client.");
  if (typeof value.endpoint !== "string") throw new OpenPetsClientError("invalid_discovery", "Discovery endpoint is invalid.");
  if (typeof value.token !== "string" || value.token.length < 16 || value.token.length > 256) throw new OpenPetsClientError("invalid_discovery", "Discovery token is invalid.");
  if (typeof value.appVersion !== "string") throw new OpenPetsClientError("invalid_discovery", "Discovery app version is invalid.");
  if (typeof value.pid !== "number" || !Number.isInteger(value.pid) || value.pid <= 0) throw new OpenPetsClientError("invalid_discovery", "Discovery pid is invalid.");

  validateEndpoint(value.endpoint);

  return {
    protocolVersion: openPetsIpcVersion,
    protocol: openPetsIpcProtocol,
    endpoint: value.endpoint,
    token: value.token,
    appVersion: value.appVersion,
    pid: value.pid,
    platform: value.platform as NodeJS.Platform,
  };
}

export function validateEndpoint(endpoint: string): void {
  if (endpoint.length < 1 || endpoint.length > 240) throw new OpenPetsClientError("invalid_discovery", "Discovery endpoint length is invalid.");
  if (endpoint.includes("\0")) throw new OpenPetsClientError("invalid_discovery", "Discovery endpoint contains NUL.");

  if (process.platform === "win32") {
    if (!endpoint.startsWith("\\\\.\\pipe\\openpets-") || endpoint.includes("/")) {
      throw new OpenPetsClientError("invalid_discovery", "Discovery endpoint is not an OpenPets named pipe.");
    }
    return;
  }

  if (!endpoint.startsWith("/") || endpoint.includes("://") || endpoint.includes("..")) {
    throw new OpenPetsClientError("invalid_discovery", "Discovery endpoint is not an absolute Unix socket path.");
  }

  if (!basename(endpoint).startsWith("openpets-") || !basename(endpoint).endsWith(".sock")) {
    throw new OpenPetsClientError("invalid_discovery", "Discovery endpoint filename is not an OpenPets socket.");
  }

  const parent = dirname(endpoint);
  const parentName = basename(parent);
  const isTmpRuntime = parent.startsWith("/tmp/") && parentName.startsWith("openpets-");
  const isXdgRuntime = parentName === "openpets";
  if (!isTmpRuntime && !isXdgRuntime) {
    throw new OpenPetsClientError("invalid_discovery", "Discovery endpoint is outside an expected OpenPets runtime directory.");
  }
}

function getSecureXdgRuntimeDir(): string | null {
  const dir = process.env.XDG_RUNTIME_DIR;
  if (!dir || !existsSync(dir)) return null;
  try {
    const stat = lstatSync(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return null;
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) return null;
    if ((stat.mode & 0o777) !== 0o700) return null;
    return dir;
  } catch {
    return null;
  }
}
