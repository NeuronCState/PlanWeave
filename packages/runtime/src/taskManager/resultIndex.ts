import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { readJsonFile, writeJsonFile } from "../json.js";
import type { ProjectWorkspace, TaskResultIndex } from "../types.js";
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

async function readTaskIndex(workspace: ProjectWorkspace, taskId: string): Promise<TaskResultIndex> {
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

export function incrementTaskIndexCount(index: TaskResultIndex, field: keyof NonNullable<TaskResultIndex["counts"]>): TaskResultIndex["counts"] {
  return {
    ...(index.counts ?? {}),
    [field]: ((index.counts ?? {})[field] ?? 0) + 1
  };
}
