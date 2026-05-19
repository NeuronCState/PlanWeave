import { loadPackage } from "../package/loadPackage.js";
import { refreshPrompt } from "./refreshPrompt.js";
import type { ManifestTaskNode, RefreshPromptsResult } from "../types.js";

export async function refreshPrompts(options: { projectRoot: string }): Promise<RefreshPromptsResult> {
  const { manifest } = await loadPackage(options.projectRoot);
  const prompts = [];
  for (const task of manifest.nodes.filter((node): node is ManifestTaskNode => node.type === "task")) {
    prompts.push(await refreshPrompt({ projectRoot: options.projectRoot, taskId: task.id }));
  }
  return { prompts };
}
