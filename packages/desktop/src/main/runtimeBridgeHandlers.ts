import { ipcMain } from "electron";
import type { DesktopBridgeInvokeMethod } from "../shared/ipcChannels.js";
import { desktopBridgeInvokeChannels } from "../shared/ipcChannels.js";
import { runtimeBridgeHandlers } from "./runtimeBridgeHandlerRegistry.js";

type RuntimeBridgeInvokeMethod = Exclude<DesktopBridgeInvokeMethod, "watchPackageFiles" | "unwatchPackageFiles">;

export function registerRuntimeBridgeHandlers(): void {
  for (const method of Object.keys(runtimeBridgeHandlers) as RuntimeBridgeInvokeMethod[]) {
    ipcMain.handle(desktopBridgeInvokeChannels[method], runtimeBridgeHandlers[method]);
  }
}
