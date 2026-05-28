import { isTmuxAvailable, type DesktopRuntimeToolAvailability } from "@planweave-ai/runtime";

export async function detectRuntimeTools(): Promise<DesktopRuntimeToolAvailability> {
  return {
    tmux: {
      available: await isTmuxAvailable(),
      command: "tmux"
    }
  };
}
