import { BrowserWindow, screen } from "electron";

import { getAppStateSnapshot, getDefaultPetPosition, resetDefaultPetPosition, setDefaultPetPosition, updatePreferences } from "./app-state.js";
import { defaultPetWindowSize, getDefaultPetInitialPosition } from "./display.js";
import { transientDisplayMs, type OpenPetsReaction } from "./local-ipc-protocol.js";
import { clearTransientReaction, createDefaultPetWindow, getSafeDefaultPetPosition, getTransientReactionAnimationMs, loadDefaultPetContent, mergePetTransientDisplay, readWindowPosition, setPetReactionState, type PetTransientDisplay } from "./pet-window.js";

let defaultPetWindow: BrowserWindow | null = null;
let paused = false;
let transientDisplay: PetTransientDisplay | null = null;
let transientDisplayTimeout: NodeJS.Timeout | null = null;
let transientAnimationTimeout: NodeJS.Timeout | null = null;

export function showDefaultPet(): void {
  updatePreferences({ openDefaultPetOnLaunch: true });
  const window = getOrCreateDefaultPetWindow();

  if (window.isMinimized()) {
    window.restore();
  }

  window.showInactive();
}

export function hideDefaultPet(): void {
  updatePreferences({ openDefaultPetOnLaunch: false });

  if (!defaultPetWindow || defaultPetWindow.isDestroyed()) {
    return;
  }

  setDefaultPetPosition(readWindowPosition(defaultPetWindow));
  defaultPetWindow.hide();
}

export function isDefaultPetVisible(): boolean {
  return Boolean(defaultPetWindow && !defaultPetWindow.isDestroyed() && defaultPetWindow.isVisible());
}

export function setDefaultPetPaused(nextPaused: boolean): void {
  paused = nextPaused;

  if (!defaultPetWindow || defaultPetWindow.isDestroyed()) {
    return;
  }

  void loadDefaultPetContent(defaultPetWindow, paused, transientDisplay);
}

export function getDefaultPetPaused(): boolean {
  return paused;
}

export function refreshDefaultPetContent(): void {
  if (!defaultPetWindow || defaultPetWindow.isDestroyed()) {
    return;
  }

  void loadDefaultPetContent(defaultPetWindow, paused, transientDisplay);
}

export function applyExternalPetReaction(reaction: OpenPetsReaction): { readonly shown: boolean; readonly reason?: string } {
  if (paused) {
    return { shown: false, reason: "paused" };
  }

  setTransientDisplay({ reaction });
  showDefaultPetForExternalEvent();
  return { shown: isDefaultPetVisible() };
}

export function applyExternalPetSay(message: string, reaction?: OpenPetsReaction): { readonly shown: boolean; readonly reason?: string } {
  if (paused) {
    return { shown: false, reason: "paused" };
  }

  setTransientDisplay({ message, reaction });
  showDefaultPetForExternalEvent();
  return { shown: isDefaultPetVisible() };
}

export function destroyDefaultPet(): void {
  if (!defaultPetWindow || defaultPetWindow.isDestroyed()) {
    defaultPetWindow = null;
    return;
  }

  setDefaultPetPosition(readWindowPosition(defaultPetWindow));
  const window = defaultPetWindow;
  defaultPetWindow = null;
  window.destroy();
}

export function installDefaultPetDisplayHandlers(): void {
  screen.on("display-added", reclampDefaultPetWindow);
  screen.on("display-removed", reclampDefaultPetWindow);
  screen.on("display-metrics-changed", reclampDefaultPetWindow);
}

function getOrCreateDefaultPetWindow(): BrowserWindow {
  if (defaultPetWindow && !defaultPetWindow.isDestroyed()) {
    return defaultPetWindow;
  }

  const position = getSafeDefaultPetPosition(getDefaultPetPosition());

  defaultPetWindow = createDefaultPetWindow({
    position,
    paused,
    display: transientDisplay,
    onPositionChanged: setDefaultPetPosition,
    onHideRequested: hideDefaultPet,
  });

  defaultPetWindow.on("closed", () => {
    defaultPetWindow = null;
  });

  return defaultPetWindow;
}

function setTransientDisplay(display: PetTransientDisplay): void {
  transientDisplay = mergePetTransientDisplay(transientDisplay, display);

  if (transientDisplayTimeout) {
    clearTimeout(transientDisplayTimeout);
  }
  if (transientAnimationTimeout) {
    clearTimeout(transientAnimationTimeout);
    transientAnimationTimeout = null;
  }

  const animationMs = getTransientReactionAnimationMs(transientDisplay);
  if (animationMs !== null && animationMs < transientDisplayMs) {
    transientAnimationTimeout = setTimeout(() => {
      if (!transientDisplay) return;
      transientDisplay = clearTransientReaction(transientDisplay);
      transientAnimationTimeout = null;
      if (defaultPetWindow && !defaultPetWindow.isDestroyed()) setPetReactionState(defaultPetWindow, "idle");
    }, animationMs);
  }

  transientDisplayTimeout = setTimeout(() => {
    transientDisplay = null;
    transientDisplayTimeout = null;
    if (transientAnimationTimeout) {
      clearTimeout(transientAnimationTimeout);
      transientAnimationTimeout = null;
    }
    refreshDefaultPetContent();
  }, transientDisplayMs);

  refreshDefaultPetContent();
}

function showDefaultPetForExternalEvent(): void {
  const state = getAppStateSnapshot();
  if (isDefaultPetVisible() || state.preferences.openDefaultPetOnLaunch) {
    showDefaultPet();
  }
}

function reclampDefaultPetWindow(): void {
  if (!defaultPetWindow || defaultPetWindow.isDestroyed()) {
    return;
  }

  const safePosition = readWindowPosition(defaultPetWindow);
  defaultPetWindow.setPosition(safePosition.x, safePosition.y, false);
  setDefaultPetPosition(safePosition);
}

export function shouldOpenDefaultPetOnLaunch(): boolean {
  return getAppStateSnapshot().preferences.openDefaultPetOnLaunch;
}

export function resetDefaultPetToInitialPosition(): void {
  const safePosition = getSafeDefaultPetPosition(getDefaultPetInitialPosition(defaultPetWindowSize));
  resetDefaultPetPosition(safePosition);

  if (defaultPetWindow && !defaultPetWindow.isDestroyed()) {
    defaultPetWindow.setPosition(safePosition.x, safePosition.y, false);
  }
}
