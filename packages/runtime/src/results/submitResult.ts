import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadPackage } from "../package/loadPackage.js";
import { ensureStateForManifest, readState, taskNodes, writeState } from "../state.js";
import { writeJsonFile } from "../json.js";
import { readResultIndex, writeResultIndex } from "./indexFile.js";
import { nextRunId } from "./runId.js";
import { runSubmitStatuses, type ResultIndex, type RunSubmitStatus, type SubmitResult } from "../types.js";

function assertTaskExists(taskIds: string[], taskId: string): void {
  if (!taskIds.includes(taskId)) {
    throw new Error(`Task '${taskId}' does not exist.`);
  }
}

function assertRunSubmitStatus(status: string): asserts status is RunSubmitStatus {
  if (!(runSubmitStatuses as readonly string[]).includes(status)) {
    throw new Error(`Unsupported submit-result status '${status}'. Expected one of: ${runSubmitStatuses.join(", ")}.`);
  }
}

export async function submitRunResult(options: {
  projectRoot: string;
  taskId: string;
  reportPath: string;
  status?: RunSubmitStatus;
}): Promise<SubmitResult> {
  const status = options.status ?? "implemented";
  assertRunSubmitStatus(status);
  const { workspace, manifest } = await loadPackage(options.projectRoot);
  assertTaskExists(
    taskNodes(manifest).map((task) => task.id),
    options.taskId
  );

  const taskResultDir = join(workspace.resultsDir, options.taskId);
  const previous = await readResultIndex(join(taskResultDir, "index.json"));
  const runId = nextRunId(previous?.runCount ?? 0);
  const runDir = join(taskResultDir, "runs", runId);
  await mkdir(runDir, { recursive: true });
  await copyFile(options.reportPath, join(runDir, "implementation.md"));
  await writeJsonFile(join(runDir, "metadata.json"), {
    taskId: options.taskId,
    runId,
    status,
    submittedAt: new Date().toISOString(),
    sourceReportPath: options.reportPath
  });

  const index: ResultIndex = {
    taskId: options.taskId,
    status,
    latestRunId: runId,
    runCount: (previous?.runCount ?? 0) + 1,
    ...(previous?.review ? { review: previous.review } : {}),
    ...(previous?.divergence ? { divergence: previous.divergence } : {})
  };
  await writeResultIndex(join(taskResultDir, "index.json"), index);

  const state = ensureStateForManifest(manifest, await readState(workspace.stateFile));
  state.tasks[options.taskId] = {
    ...state.tasks[options.taskId],
    status,
    lastRunId: runId,
    claimedBy: null
  };
  state.currentTaskId = state.currentTaskId === options.taskId ? null : state.currentTaskId;
  await writeState(workspace.stateFile, state);

  return { taskId: options.taskId, runId, status, index };
}
