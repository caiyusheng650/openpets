import { LeaseManager } from "./lease-manager.js";

let now = 1_000;
const opened: string[] = [];
const closed: string[] = [];
const manager = new LeaseManager({
  ttlMs: 100,
  now: () => now,
  resolveTarget: (requestedPetId) => {
    if (!requestedPetId) return { targetKind: "default", actualPetId: "builtin" };
    if (requestedPetId === "missing") return { targetKind: "default", actualPetId: "builtin", fallbackReason: "pet_not_installed" };
    return { targetKind: "explicit", actualPetId: requestedPetId };
  },
  getDefaultPetId: () => "builtin",
  getPetDisplayName: (petId) => petId,
  onFirstExplicitLease: (petId) => opened.push(petId),
  onLastExplicitLease: (petId) => closed.push(petId),
});

const defaultLease = manager.acquire();
if (!defaultLease.usingDefaultPet || defaultLease.targetKind !== "default") throw new Error("Default lease did not target default.");
manager.release(defaultLease.leaseId);
if (closed.length !== 0) throw new Error("Default release closed a temp pet.");

const first = manager.acquire("snoopy");
const second = manager.acquire("snoopy");
if (opened.join(",") !== "snoopy") throw new Error("Explicit pet did not open once for multiple leases.");
manager.release(first.leaseId);
if (closed.length !== 0) throw new Error("Explicit pet closed before final lease release.");
manager.release(first.leaseId);
manager.release(second.leaseId);
if (closed.join(",") !== "snoopy") throw new Error("Explicit pet did not close after final release.");

const missing = manager.acquire("missing");
if (missing.fallbackReason !== "pet_not_installed" || !missing.usingDefaultPet) throw new Error("Missing pet did not fall back to default.");
manager.release(missing.leaseId);

const expiring = manager.acquire("tux");
now += 50;
manager.heartbeat(expiring.leaseId);
now += 75;
if (manager.cleanupExpired().length !== 0) throw new Error("Heartbeat did not extend lease.");
now += 50;
if (manager.cleanupExpired().length !== 1) throw new Error("Expired lease was not cleaned up.");

const expiredBeforeHeartbeat = manager.acquire("dobby");
now += 200;
assertRejects(() => manager.heartbeat(expiredBeforeHeartbeat.leaseId));
if (manager.get(expiredBeforeHeartbeat.leaseId) !== null) throw new Error("Expired lease was still readable before cleanup.");

console.log("Lease manager validation passed.");

function assertRejects(callback: () => unknown): void {
  try {
    callback();
  } catch {
    return;
  }
  throw new Error("Expected lease operation to reject.");
}
