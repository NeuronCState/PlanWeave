import { join } from "node:path";
import { loadPackage } from "../package/loadPackage.js";
import { ensureStateForManifest, readState, taskNodes, writeState } from "../state.js";
import { readResultIndex, writeResultIndex } from "../results/indexFile.js";
import type { MarkDivergedResult, ResultIndex } from "../types.js";

export async function markDiverged(options: {
  projectRoot: string;
  taskId: string;
  reason: string;
}): Promise<MarkDivergedResult> {
  const { workspace, manifest } = await loadPackage(options.projectRoot);
  if (!taskNodes(manifest).some((task) => task.id === options.taskId)) {
    throw new Error(`Task '${options.taskId}' does not exist.`);
  }

  const state = ensureStateForManifest(manifest, await readState(workspace.stateFile));
  if (state.tasks[options.taskId]?.status === "verified") {
    throw new Error("A verified task cannot be marked as diverged.");
  }
  const divergence = { reason: options.reason, recordedAt: new Date().toISOString() };
  state.tasks[options.taskId] = {
    ...state.tasks[options.taskId],
    status: "diverged",
    claimedBy: null,
    divergence
  };
  state.currentTaskId = state.currentTaskId === options.taskId ? null : state.currentTaskId;
  await writeState(workspace.stateFile, state);

  const indexPath = join(workspace.resultsDir, options.taskId, "index.json");
  const previous = await readResultIndex(indexPath);
  const index: ResultIndex = {
    taskId: options.taskId,
    status: "diverged",
    latestRunId: previous?.latestRunId ?? null,
    runCount: previous?.runCount ?? 0,
    ...(previous?.review ? { review: previous.review } : {}),
    divergence
  };
  await writeResultIndex(indexPath, index);

  return { taskId: options.taskId, status: "diverged", reason: options.reason };
}
