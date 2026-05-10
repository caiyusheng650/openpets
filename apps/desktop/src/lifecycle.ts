import { app } from "electron";

import { closeAllAgentPets } from "./agent-pet-controller.js";
import { destroyDefaultPet } from "./default-pet-controller.js";
import { stopLocalIpcServer } from "./local-ipc.js";
import { focusOpenTaskWindows } from "./windows.js";

let intentionalQuit = false;

export function installAppLifecycle(): void {
  app.on("second-instance", () => {
    console.log("Second OpenPets launch requested; keeping existing instance.");
    focusOpenTaskWindows();
  });

  app.on("window-all-closed", () => {
    if (!intentionalQuit) {
      console.log("All OpenPets task windows closed; keeping tray app running.");
    }
  });

  app.on("activate", () => {
    console.log("OpenPets activate event received; not opening a dashboard window.");
  });

  app.on("before-quit", () => {
    intentionalQuit = true;
    stopLocalIpcServer();
    closeAllAgentPets();
    destroyDefaultPet();
  });
}

export function quitOpenPets(): void {
  intentionalQuit = true;
  app.quit();
}
