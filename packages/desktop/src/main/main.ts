import { app, BrowserWindow } from "electron";
import { registerPackageWatchHandlers } from "./packageWatch.js";
import { registerRuntimeBridgeHandlers } from "./runtimeBridgeHandlers.js";
import { createWindow } from "./window.js";

const isDev = process.env.PLANWEAVE_DESKTOP_DEV_SERVER_URL !== undefined;
const isSmoke = process.env.PLANWEAVE_DESKTOP_SMOKE === "1";

if (isSmoke && process.env.PLANWEAVE_DESKTOP_SMOKE_USER_DATA_DIR) {
  app.setPath("userData", process.env.PLANWEAVE_DESKTOP_SMOKE_USER_DATA_DIR);
}

registerRuntimeBridgeHandlers();
registerPackageWatchHandlers();

app.whenReady().then(() => {
  void createWindow({ isDev, isSmoke }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    app.exit(1);
  });
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow({ isDev, isSmoke });
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
