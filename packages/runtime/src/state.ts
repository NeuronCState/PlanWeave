import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname } from "node:path";
import { readJsonFile, writeJsonFile } from "./json.js";
import type { ManifestTaskNode, PlanPackageManifest, RuntimeState, TaskState } from "./types.js";

export function createEmptyState(): RuntimeState {
  return {
    currentTaskId: null,
    tasks: {}
  };
}

export async function readState(stateFile: string): Promise<RuntimeState> {
  try {
    await access(stateFile, constants.R_OK);
  } catch {
    return createEmptyState();
  }
  return readJsonFile<RuntimeState>(stateFile);
}

export async function writeState(stateFile: string, state: RuntimeState): Promise<void> {
  await mkdir(dirname(stateFile), { recursive: true });
  await writeJsonFile(stateFile, state);
}

export function taskNodes(manifest: PlanPackageManifest): ManifestTaskNode[] {
  return manifest.nodes.filter((node): node is ManifestTaskNode => node.type === "task");
}

export function dependencyIds(manifest: PlanPackageManifest, taskId: string): string[] {
  return manifest.edges
    .filter((edge) => edge.type === "depends_on" && edge.from === taskId)
    .map((edge) => edge.to);
}

export function dependenciesSatisfied(manifest: PlanPackageManifest, state: RuntimeState, taskId: string): boolean {
  return dependencyIds(manifest, taskId).every((id) => {
    const status = state.tasks[id]?.status;
    return status === "implemented" || status === "verified";
  });
}

export function createDefaultTaskState(
  manifest: PlanPackageManifest,
  state: RuntimeState,
  taskId: string
): TaskState {
  const blockedBy = dependencyIds(manifest, taskId).filter((id) => {
    const status = state.tasks[id]?.status;
    return status !== "implemented" && status !== "verified";
  });
  return {
    status: blockedBy.length === 0 ? "ready" : "planned",
    claimedBy: null,
    lastRunId: null,
    blockedBy
  };
}

export function ensureStateForManifest(manifest: PlanPackageManifest, state: RuntimeState): RuntimeState {
  const next: RuntimeState = {
    currentTaskId: state.currentTaskId,
    tasks: { ...state.tasks }
  };

  for (const task of taskNodes(manifest)) {
    next.tasks[task.id] = next.tasks[task.id] ?? createDefaultTaskState(manifest, next, task.id);
    if (next.tasks[task.id].status === "planned" && dependenciesSatisfied(manifest, next, task.id)) {
      next.tasks[task.id] = {
        ...next.tasks[task.id],
        status: "ready",
        blockedBy: []
      };
    } else if (next.tasks[task.id].status === "planned") {
      next.tasks[task.id] = {
        ...next.tasks[task.id],
        blockedBy: dependencyIds(manifest, task.id).filter((id) => {
          const status = next.tasks[id]?.status;
          return status !== "implemented" && status !== "verified";
        })
      };
    }
  }

  return next;
}
