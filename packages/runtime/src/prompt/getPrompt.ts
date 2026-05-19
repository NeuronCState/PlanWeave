import { refreshPrompt } from "./refreshPrompt.js";

export async function getPrompt(options: { projectRoot: string; taskId: string }): Promise<string> {
  const surface = await refreshPrompt(options);
  return surface.markdown;
}
