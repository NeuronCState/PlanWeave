import type { DesktopBridgeApi } from "@planweave-ai/runtime";

declare global {
  interface Window {
    planweave: DesktopBridgeApi;
  }
}

export {};
