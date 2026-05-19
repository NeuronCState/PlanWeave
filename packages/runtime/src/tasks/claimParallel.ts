import { loadPackage } from "../package/loadPackage.js";
import { ensureStateForManifest, readState, writeState } from "../state.js";
import { orderedClaimableTasks } from "./claimNext.js";
import { canShareParallelBatch } from "./parallelSafety.js";
import type { ManifestTaskNode, ParallelClaimResult } from "../types.js";

export async function claimNextParallel(options: { projectRoot: string; force?: boolean }): Promise<ParallelClaimResult> {
  const { workspace, manifest } = await loadPackage(options.projectRoot);
  const state = ensureStateForManifest(manifest, await readState(workspace.stateFile));

  if (!manifest.execution.parallel.enabled) {
    await writeState(workspace.stateFile, state);
    return { tasks: [], status: "disabled" };
  }

  const current = Object.entries(state.tasks)
    .filter(([, task]) => task.status === "in_progress")
    .map(([taskId]) => taskId);
  if (current.length > 0 && !options.force) {
    return { tasks: current, status: "current" };
  }

  const selected: ManifestTaskNode[] = [];
  for (const candidate of orderedClaimableTasks(manifest, state)) {
    if (selected.length >= manifest.execution.parallel.maxConcurrent) {
      break;
    }
    if (canShareParallelBatch(manifest, selected, candidate)) {
      selected.push(candidate);
    }
  }

  for (const task of selected) {
    state.tasks[task.id] = {
      ...state.tasks[task.id],
      status: "in_progress",
      claimedBy: "agent",
      blockedBy: []
    };
  }
  state.currentTaskId = selected[0]?.id ?? state.currentTaskId;
  await writeState(workspace.stateFile, state);

  return {
    tasks: selected.map((task) => task.id),
    status: selected.length > 0 ? "claimed" : "none"
  };
}
