import { loadPackage } from "../package/loadPackage.js";
import { compileTaskGraph } from "../graph/compileTaskGraph.js";
import { refreshPrompt } from "./refreshPrompt.js";
import type { RefreshPromptsResult } from "../types.js";

export async function refreshPrompts(options: { projectRoot: string }): Promise<RefreshPromptsResult> {
  const { manifest } = await loadPackage(options.projectRoot);
  const graph = compileTaskGraph(manifest);
  const prompts = [];
  for (const task of graph.tasksInManifestOrder) {
    prompts.push(await refreshPrompt({ projectRoot: options.projectRoot, taskId: task.id }));
  }
  return { prompts };
}
