import { isTmuxAvailable, type DesktopRuntimeToolAvailability } from "@planweave/runtime";

export async function detectRuntimeTools(): Promise<DesktopRuntimeToolAvailability> {
  return {
    tmux: {
      available: await isTmuxAvailable(),
      command: "tmux"
    }
  };
}
