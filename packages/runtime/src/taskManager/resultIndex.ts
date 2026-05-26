import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { readJsonFile, writeJsonFile } from "../json.js";
import type { ProjectWorkspace, TaskResultIndex, ValidationIssue } from "../types.js";
import { exists } from "./runtimeContext.js";

export function nextId(prefix: string, count: number): string {
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

export async function listDirCount(path: string): Promise<number> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).length;
  } catch {
    return 0;
  }
}

function taskIndexPath(workspace: ProjectWorkspace, taskId: string): string {
  return join(workspace.resultsDir, taskId, "index.json");
}

export async function readTaskIndex(workspace: ProjectWorkspace, taskId: string): Promise<TaskResultIndex> {
  const path = taskIndexPath(workspace, taskId);
  return (await exists(path)) ? readJsonFile<TaskResultIndex>(path) : {};
}

async function writeTaskIndex(workspace: ProjectWorkspace, taskId: string, index: TaskResultIndex): Promise<void> {
  await mkdir(join(workspace.resultsDir, taskId), { recursive: true });
  await writeJsonFile(taskIndexPath(workspace, taskId), index);
}

export async function updateTaskIndex(
  workspace: ProjectWorkspace,
  taskId: string,
  update: (index: TaskResultIndex) => TaskResultIndex
): Promise<TaskResultIndex> {
  const next = update(await readTaskIndex(workspace, taskId));
  await writeTaskIndex(workspace, taskId, next);
  return next;
}

export async function clearReviewCompletionReason(workspace: ProjectWorkspace, taskId: string, reviewBlockRef: string): Promise<void> {
  await updateTaskIndex(workspace, taskId, (index) => {
    const completionReasons = { ...(index.reviewCompletionReasonByBlock ?? {}) };
    delete completionReasons[reviewBlockRef];
    const warnings = (index.warnings ?? []).filter(
      (warning) => !(warning.code === "review_max_cycles_reached" && warning.path === reviewBlockRef)
    );
    return {
      ...index,
      reviewCompletionReasonByBlock: Object.keys(completionReasons).length > 0 ? completionReasons : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  });
}

export async function recordReviewCompletionReason(options: {
  workspace: ProjectWorkspace;
  taskId: string;
  reviewBlockRef: string;
  completionReason: "passed" | "max_cycles_reached";
  warning?: ValidationIssue;
}): Promise<void> {
  await updateTaskIndex(options.workspace, options.taskId, (index) => ({
    ...index,
    reviewCompletionReasonByBlock: {
      ...(index.reviewCompletionReasonByBlock ?? {}),
      [options.reviewBlockRef]: options.completionReason
    },
    warnings: options.warning ? [...(index.warnings ?? []), options.warning] : index.warnings
  }));
}

export function incrementTaskIndexCount(index: TaskResultIndex, field: keyof NonNullable<TaskResultIndex["counts"]>): TaskResultIndex["counts"] {
  return {
    ...(index.counts ?? {}),
    [field]: ((index.counts ?? {})[field] ?? 0) + 1
  };
}
