import { loadPackage } from "../package/loadPackage.js";
import { dependenciesSatisfied, ensureStateForManifest, readState, taskNodes, writeState } from "../state.js";
import type { ClaimResult, ManifestTaskNode, PlanPackageManifest, RuntimeState } from "../types.js";

function existingInProgress(state: RuntimeState): string | null {
  return Object.entries(state.tasks).find(([, task]) => task.status === "in_progress")?.[0] ?? null;
}

function claimableTasks(manifest: PlanPackageManifest, state: RuntimeState): ManifestTaskNode[] {
  return taskNodes(manifest).filter((task) => {
    const taskState = state.tasks[task.id];
    if (!taskState) {
      return false;
    }
    if (taskState.status === "needs_changes") {
      return dependenciesSatisfied(manifest, state, task.id);
    }
    if (taskState.status === "ready" || taskState.status === "planned") {
      return dependenciesSatisfied(manifest, state, task.id);
    }
    return false;
  });
}

function compareCandidatePriority(state: RuntimeState, left: ManifestTaskNode, right: ManifestTaskNode): number {
  const leftPriority = state.tasks[left.id]?.status === "needs_changes" ? 0 : 1;
  const rightPriority = state.tasks[right.id]?.status === "needs_changes" ? 0 : 1;
  return leftPriority - rightPriority;
}

export function orderedClaimableTasks(manifest: PlanPackageManifest, state: RuntimeState): ManifestTaskNode[] {
  return claimableTasks(manifest, state).sort((left, right) => compareCandidatePriority(state, left, right));
}

export async function claimNextTask(options: { projectRoot: string; force?: boolean }): Promise<ClaimResult> {
  const { workspace, manifest } = await loadPackage(options.projectRoot);
  const state = ensureStateForManifest(manifest, await readState(workspace.stateFile));
  const current = existingInProgress(state);
  if (current && !options.force) {
    return { taskId: current, status: "current", task: state.tasks[current] };
  }

  const next = orderedClaimableTasks(manifest, state)[0];
  if (!next) {
    await writeState(workspace.stateFile, state);
    return { taskId: null, status: "none" };
  }

  state.tasks[next.id] = {
    ...state.tasks[next.id],
    status: "in_progress",
    claimedBy: "agent",
    blockedBy: []
  };
  state.currentTaskId = next.id;
  await writeState(workspace.stateFile, state);
  return { taskId: next.id, status: "claimed", task: state.tasks[next.id] };
}
