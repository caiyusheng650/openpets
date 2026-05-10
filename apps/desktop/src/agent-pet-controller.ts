import { BrowserWindow } from "electron";

import { getAppStateSnapshot } from "./app-state.js";
import { defaultPetWindowSize, getDefaultPetInitialPosition } from "./display.js";
import { transientDisplayMs, type OpenPetsReaction } from "./local-ipc-protocol.js";
import { clearTransientReaction, createAgentPetWindow, getTransientReactionAnimationMs, loadExplicitPetContent, mergePetTransientDisplay, setPetReactionState, type PetTransientDisplay } from "./pet-window.js";

const agentPetWindows = new Map<string, BrowserWindow>();
const transientDisplays = new Map<string, PetTransientDisplay>();
const transientTimers = new Map<string, NodeJS.Timeout>();
const transientAnimationTimers = new Map<string, NodeJS.Timeout>();
const dismissedAgentPets = new Set<string>();

export function showAgentPet(petId: string): boolean {
  if (dismissedAgentPets.has(petId)) return false;
  const window = getOrCreateAgentPetWindow(petId);
  if (window.isMinimized()) window.restore();
  window.showInactive();
  return true;
}

export function closeAgentPetIfOpen(petId: string): void {
  const window = agentPetWindows.get(petId);
  if (!window || window.isDestroyed()) return;
  agentPetWindows.delete(petId);
  clearAgentDisplay(petId);
  window.destroy();
}

export function dismissAgentPetForActiveLease(petId: string): void {
  dismissedAgentPets.add(petId);
  closeAgentPetIfOpen(petId);
}

export function clearAgentPetDismissal(petId: string): void {
  dismissedAgentPets.delete(petId);
}

export function clearAgentPetLeaseState(petId: string): void {
  dismissedAgentPets.delete(petId);
  closeAgentPetIfOpen(petId);
  clearAgentDisplay(petId);
}

export function applyAgentPetReaction(petId: string, reaction: OpenPetsReaction): { readonly shown: boolean; readonly reason?: string } {
  setAgentDisplay(petId, { reaction });
  const shown = showAgentPet(petId);
  return shown ? { shown } : { shown, reason: "dismissed" };
}

export function applyAgentPetSay(petId: string, message: string, reaction?: OpenPetsReaction): { readonly shown: boolean; readonly reason?: string } {
  setAgentDisplay(petId, { message, reaction });
  const shown = showAgentPet(petId);
  return shown ? { shown } : { shown, reason: "dismissed" };
}

export function closeAllAgentPets(): void {
  for (const petId of [...agentPetWindows.keys()]) {
    closeAgentPetIfOpen(petId);
  }
}

export function refreshAgentPetContent(): void {
  for (const [petId, window] of agentPetWindows.entries()) {
    if (!window.isDestroyed()) {
      void loadExplicitPetContent(window, petId, transientDisplays.get(petId) ?? null);
    }
  }
}

function getOrCreateAgentPetWindow(petId: string): BrowserWindow {
  const existing = agentPetWindows.get(petId);
  if (existing && !existing.isDestroyed()) return existing;

  const pet = getAppStateSnapshot().pets.installed.find((candidate) => candidate.id === petId);
  if (!pet) throw new Error(`Installed pet is unavailable: ${petId}`);
  const offset = agentPetWindows.size + 1;
  const initial = getDefaultPetInitialPosition(defaultPetWindowSize);
  const window = createAgentPetWindow({
    petId,
    displayName: pet.displayName,
    position: { x: initial.x - offset * 36, y: initial.y - offset * 24 },
    display: transientDisplays.get(petId) ?? null,
    onCloseRequested: () => dismissAgentPetForActiveLease(petId),
  });

  window.on("closed", () => {
    agentPetWindows.delete(petId);
    clearAgentDisplay(petId);
  });
  agentPetWindows.set(petId, window);
  return window;
}

function setAgentDisplay(petId: string, display: PetTransientDisplay): void {
  const preparedDisplay = mergePetTransientDisplay(transientDisplays.get(petId) ?? null, display);
  transientDisplays.set(petId, preparedDisplay);
  const existingTimer = transientTimers.get(petId);
  if (existingTimer) clearTimeout(existingTimer);
  const existingAnimationTimer = transientAnimationTimers.get(petId);
  if (existingAnimationTimer) clearTimeout(existingAnimationTimer);

  const animationMs = getTransientReactionAnimationMs(preparedDisplay);
  if (animationMs !== null && animationMs < transientDisplayMs) {
    const animationTimer = setTimeout(() => {
      const current = transientDisplays.get(petId);
      if (!current) return;
      const updated = clearTransientReaction(current);
      transientDisplays.set(petId, updated);
      transientAnimationTimers.delete(petId);
      const window = agentPetWindows.get(petId);
      if (window && !window.isDestroyed()) setPetReactionState(window, "idle");
    }, animationMs);
    transientAnimationTimers.set(petId, animationTimer);
  }

  const timer = setTimeout(() => {
    transientDisplays.delete(petId);
    transientTimers.delete(petId);
    const animationTimer = transientAnimationTimers.get(petId);
    if (animationTimer) clearTimeout(animationTimer);
    transientAnimationTimers.delete(petId);
    const window = agentPetWindows.get(petId);
    if (window && !window.isDestroyed()) void loadExplicitPetContent(window, petId, null);
  }, transientDisplayMs);
  transientTimers.set(petId, timer);
  const window = agentPetWindows.get(petId);
  if (window && !window.isDestroyed()) void loadExplicitPetContent(window, petId, preparedDisplay);
}

function clearAgentDisplay(petId: string): void {
  const timer = transientTimers.get(petId);
  if (timer) clearTimeout(timer);
  const animationTimer = transientAnimationTimers.get(petId);
  if (animationTimer) clearTimeout(animationTimer);
  transientTimers.delete(petId);
  transientAnimationTimers.delete(petId);
  transientDisplays.delete(petId);
}
