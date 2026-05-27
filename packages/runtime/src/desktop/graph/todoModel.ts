import { compileTaskGraph } from "../../graph/compileTaskGraph.js";
import { loadPackage } from "../../package/loadPackage.js";
import { getExecutionStatus } from "../../taskManager/index.js";
import type { PackageWorkspaceRef } from "../../types.js";
import type { DesktopProjectExecutionPhase, DesktopProjectExecutionPlan, DesktopTodoGroups, DesktopTodoItem } from "../types.js";
import { getBlock } from "./graphHelpers.js";
import { mapProjectTaskCanvases } from "./projectCanvasAggregation.js";

function emptyTodoGroups(): DesktopTodoGroups {
  return {
    planned: [],
    ready: [],
    in_progress: [],
    completed: [],
    needs_changes: [],
    blocked: [],
    diverged: [],
    implemented: []
  };
}

async function getTodoGroupsForWorkspace(
  projectRoot: PackageWorkspaceRef,
  canvasMeta?: { canvasId: string; canvasName: string }
): Promise<DesktopTodoGroups> {
  const { manifest } = await loadPackage(projectRoot);
  const graph = compileTaskGraph(manifest);
  const status = await getExecutionStatus({ projectRoot });
  const taskStatusById = new Map(status.tasks.map((task) => [task.taskId, task.status]));
  const claimHintByRef = new Map(status.claimHints.map((hint) => [hint.ref, hint]));
  const groups = emptyTodoGroups();
  for (const blockStatus of status.blocks) {
    const block = getBlock(graph, blockStatus.ref);
    const taskDependencyBlockers = (graph.taskDependenciesByTask.get(blockStatus.taskId) ?? []).filter((taskId) => taskStatusById.get(taskId) !== "implemented");
    const blockDependencyBlockers = (graph.blockDependenciesByRef.get(blockStatus.ref) ?? []).filter((dependency) => {
      const dependencyStatus = status.blocks.find((candidate) => candidate.ref === dependency)?.status;
      return dependencyStatus !== "completed";
    });
    const dependencyBlockers = [...taskDependencyBlockers, ...blockDependencyBlockers];
    const displayStatus = blockStatus.status === "ready" && dependencyBlockers.length > 0 ? "planned" : blockStatus.status;
    const groupName: keyof DesktopTodoGroups = taskStatusById.get(blockStatus.taskId) === "implemented" ? "implemented" : displayStatus;
    const item: DesktopTodoItem = {
      canvasId: canvasMeta?.canvasId,
      canvasName: canvasMeta?.canvasName,
      ref: blockStatus.ref,
      taskId: blockStatus.taskId,
      blockId: blockStatus.blockId,
      title: block.title,
      status: displayStatus,
      dependencyBlockers,
      parallelSafe: graph.parallelSafeByBlockRef.get(blockStatus.ref) ?? false,
      locks: graph.locksByBlockRef.get(blockStatus.ref) ?? [],
      reviewGate: claimHintByRef.get(blockStatus.ref)?.reviewGate ?? null
    };
    groups[groupName].push(item);
  }
  return groups;
}

export async function getTodoGroups(projectRoot: string): Promise<DesktopTodoGroups> {
  const groups = emptyTodoGroups();
  const canvasGroupItems = await mapProjectTaskCanvases(projectRoot, ({ canvasId, canvasName, workspace }) =>
    getTodoGroupsForWorkspace(workspace, { canvasId, canvasName })
  );
  for (const canvasGroups of canvasGroupItems) {
    for (const [groupName, items] of Object.entries(canvasGroups) as Array<[keyof DesktopTodoGroups, DesktopTodoItem[]]>) {
      groups[groupName].push(...items);
    }
  }
  return groups;
}

function executionPhaseFromGroups(
  phaseIndex: number,
  canvasId: string,
  canvasName: string,
  taskCount: number,
  groups: DesktopTodoGroups
): DesktopProjectExecutionPhase {
  const readyQueue = groups.ready;
  return {
    phaseIndex,
    canvasId,
    canvasName,
    taskCount,
    readyQueue,
    parallelReadyQueue: readyQueue.filter((item) => item.parallelSafe),
    sequentialReadyQueue: readyQueue.filter((item) => !item.parallelSafe),
    blockedCount: groups.blocked.length + groups.diverged.length + groups.needs_changes.length,
    inProgressCount: groups.in_progress.length,
    completedCount: groups.completed.length + groups.implemented.length
  };
}

export async function getProjectExecutionPlan(projectRoot: string): Promise<DesktopProjectExecutionPlan> {
  const phases = await mapProjectTaskCanvases(projectRoot, async ({ canvas, canvasId, canvasName, workspace }, index) => {
    const groups = await getTodoGroupsForWorkspace(workspace, { canvasId, canvasName });
    return executionPhaseFromGroups(index + 1, canvasId, canvasName, canvas.taskCount, groups);
  });
  return {
    phases,
    readyQueue: phases.flatMap((phase) => phase.readyQueue),
    notes: ["Cross-canvas dependency order is registry order until a project-level canvas dependency contract exists."]
  };
}
