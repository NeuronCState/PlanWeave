import { loadPackage } from "../package/loadPackage.js";
import { ensureStateForManifest, readState, taskNodes, writeState } from "../state.js";
import { taskStatuses, type PlanStatus } from "../types.js";

export async function getStatus(options: { projectRoot: string }): Promise<PlanStatus> {
  const { workspace, manifest } = await loadPackage(options.projectRoot);
  const state = ensureStateForManifest(manifest, await readState(workspace.stateFile));
  await writeState(workspace.stateFile, state);
  const counts = Object.fromEntries(taskStatuses.map((status) => [status, 0])) as PlanStatus["counts"];
  for (const task of taskNodes(manifest)) {
    counts[state.tasks[task.id]?.status ?? "planned"] += 1;
  }
  return {
    projectId: workspace.id,
    projectRoot: workspace.rootPath,
    taskTotal: taskNodes(manifest).length,
    counts,
    currentTaskId: state.currentTaskId,
    needsChanges: counts.needs_changes,
    diverged: counts.diverged
  };
}
