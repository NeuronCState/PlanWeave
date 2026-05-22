import { useEffect } from "react";
import { desktopSettingsKey } from "../settings";
import type { DesktopUiSettings } from "../types";

export function useDesktopSettingsEffects(settings: DesktopUiSettings) {
  useEffect(() => {
    window.localStorage.setItem(desktopSettingsKey, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    const prefersDark =
      settings.appearance === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (settings.appearance === "dark" || prefersDark) {
      root.classList.add("dark");
    }
  }, [settings.appearance]);
}
