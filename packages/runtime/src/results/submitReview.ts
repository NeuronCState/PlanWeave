import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadPackage } from "../package/loadPackage.js";
import { ensureStateForManifest, readState, taskNodes, writeState } from "../state.js";
import { readResultIndex, writeResultIndex } from "./indexFile.js";
import { reviewStatuses, type ResultIndex, type ReviewStatus, type SubmitReviewResult } from "../types.js";

function assertReviewStatus(status: string): asserts status is ReviewStatus {
  if (!(reviewStatuses as readonly string[]).includes(status)) {
    throw new Error(`Unsupported submit-review status '${status}'. Expected one of: ${reviewStatuses.join(", ")}.`);
  }
}

export async function submitReview(options: {
  projectRoot: string;
  taskId: string;
  reportPath: string;
  status: ReviewStatus;
}): Promise<SubmitReviewResult> {
  assertReviewStatus(options.status);
  const { workspace, manifest } = await loadPackage(options.projectRoot);
  if (!taskNodes(manifest).some((task) => task.id === options.taskId)) {
    throw new Error(`Task '${options.taskId}' does not exist.`);
  }

  const taskResultDir = join(workspace.resultsDir, options.taskId);
  await mkdir(taskResultDir, { recursive: true });
  await copyFile(options.reportPath, join(taskResultDir, "review.md"));

  const taskStatus = options.status === "passed" ? "verified" : "needs_changes";
  const previous = await readResultIndex(join(taskResultDir, "index.json"));
  const index: ResultIndex = {
    taskId: options.taskId,
    status: taskStatus,
    latestRunId: previous?.latestRunId ?? null,
    runCount: previous?.runCount ?? 0,
    review: {
      status: options.status,
      reviewedAt: new Date().toISOString(),
      reviewer: "human"
    },
    ...(previous?.divergence ? { divergence: previous.divergence } : {})
  };
  await writeResultIndex(join(taskResultDir, "index.json"), index);

  const state = ensureStateForManifest(manifest, await readState(workspace.stateFile));
  state.tasks[options.taskId] = {
    ...state.tasks[options.taskId],
    status: taskStatus,
    claimedBy: null
  };
  state.currentTaskId = state.currentTaskId === options.taskId ? null : state.currentTaskId;
  await writeState(workspace.stateFile, state);

  return {
    taskId: options.taskId,
    status: options.status,
    taskStatus,
    index
  };
}
