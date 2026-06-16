import { buildExecutionStatus, type ExecutionStatus } from "../../taskManager/executionStatus.js";
import { createProjectGraphClaimGuardFromAggregation } from "../../taskManager/projectGraphClaimGuard.js";
import { loadRuntime, type RuntimeContext } from "../../taskManager/runtimeContext.js";
import type { DesktopProjectExecutionPhase, DesktopProjectExecutionPlan, DesktopTodoGroups, DesktopTodoItem } from "../types.js";
import { getBlock } from "./graphHelpers.js";
import {
  loadProjectCanvasAggregation,
  projectBlockersForTask,
  runtimeSnapshotFromGraphState,
  type ProjectCanvasAggregationContext
} from "./projectCanvasAggregation.js";

export function emptyTodoGroups(): DesktopTodoGroups {
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

type CanvasTodoRuntimeContext = RuntimeContext & {
  status: ExecutionStatus;
};

function buildTodoGroupsForRuntime(
  context: CanvasTodoRuntimeContext,
  canvasMeta?: { canvasId: string; canvasName: string }
): DesktopTodoGroups {
  const { graph, status } = context;
  const taskStatusById = new Map(status.tasks.map((task) => [task.taskId, task.status]));
  const claimHintByRef = new Map(status.claimHints.map((hint) => [hint.ref, hint]));
  const groups = emptyTodoGroups();
  for (const blockStatus of status.blocks) {
    const block = getBlock(graph, blockStatus.ref);
    const claimHint = claimHintByRef.get(blockStatus.ref);
    const dependencyBlockers = claimHint ? [...claimHint.blockedByTasks, ...claimHint.blockedByBlocks] : [];
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
      reviewGate: claimHint?.reviewGate ?? null
    };
    groups[groupName].push(item);
  }
  return groups;
}

function executionPhaseFromGroups(
  phaseIndex: number,
  canvasId: string,
  canvasName: string,
  taskCount: number,
  groups: DesktopTodoGroups,
  projectBlockedReadyCount = 0
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
    blockedCount: groups.blocked.length + groups.diverged.length + groups.needs_changes.length + projectBlockedReadyCount,
    inProgressCount: groups.in_progress.length,
    completedCount: groups.completed.length + groups.implemented.length
  };
}

export type CanvasExecutionSnapshot = {
  groups: DesktopTodoGroups;
  taskCount: number;
  runtime: RuntimeContext | null;
  status: ExecutionStatus | null;
  error: unknown | null;
};

export type ProjectTodoContext = {
  aggregation: ProjectCanvasAggregationContext;
  snapshotsByCanvas: Map<string, CanvasExecutionSnapshot>;
};

async function canvasExecutionSnapshot(
  aggregation: ProjectCanvasAggregationContext,
  canvasId: string,
  runtime: RuntimeContext | undefined
): Promise<CanvasExecutionSnapshot> {
  const canvas = aggregation.canvasesById.get(canvasId);
  if (!canvas) {
    return {
      groups: emptyTodoGroups(),
      taskCount: 0,
      runtime: null,
      status: null,
      error: new Error(`Project canvas '${canvasId}' is missing from aggregation.`)
    };
  }
  const canvasRuntime = runtime ?? await loadRuntime({ projectRoot: canvas.workspace });
  const status = await buildExecutionStatus(canvasRuntime, {
    claimGuard: createProjectGraphClaimGuardFromAggregation(canvasRuntime, aggregation)
  });
  const groups = buildTodoGroupsForRuntime({ ...canvasRuntime, status }, {
    canvasId,
    canvasName: canvas.canvasName
  });
  return {
    groups,
    taskCount: canvasRuntime.graph.taskNodesInManifestOrder.length,
    runtime: canvasRuntime,
    status,
    error: null
  };
}

function applyProjectBlockers(
  aggregation: ProjectCanvasAggregationContext,
  canvasId: string,
  groups: DesktopTodoGroups
): { groups: DesktopTodoGroups; blockedReadyCount: number } {
  const next = emptyTodoGroups();
  let blockedReadyCount = 0;
  for (const [groupName, items] of Object.entries(groups) as Array<[keyof DesktopTodoGroups, DesktopTodoItem[]]>) {
    for (const item of items) {
      const projectBlockers = projectBlockersForTask(aggregation, canvasId, item.taskId);
      const nextItem = projectBlockers.length > 0
        ? { ...item, dependencyBlockers: Array.from(new Set([...item.dependencyBlockers, ...projectBlockers])) }
        : item;
      if (groupName === "ready" && projectBlockers.length > 0) {
        next.planned.push({ ...nextItem, status: "planned" });
        blockedReadyCount += 1;
      } else {
        next[groupName].push(nextItem);
      }
    }
  }
  return { groups: next, blockedReadyCount };
}

export async function loadProjectTodoContext(projectRoot: string): Promise<ProjectTodoContext> {
  const runtimesByCanvas = new Map<string, RuntimeContext>();
  const aggregation = await loadProjectCanvasAggregation(projectRoot, {
    loadRuntimeSnapshot: async (workspace, canvasId) => {
      const runtime = await loadRuntime({ projectRoot: workspace });
      runtimesByCanvas.set(canvasId, runtime);
      return runtimeSnapshotFromGraphState(runtime.graph, runtime.state);
    }
  });
  const snapshotsByCanvas = new Map<string, CanvasExecutionSnapshot>();

  for (const canvasId of aggregation.orderedCanvasIds) {
    try {
      snapshotsByCanvas.set(canvasId, await canvasExecutionSnapshot(aggregation, canvasId, runtimesByCanvas.get(canvasId)));
    } catch (error) {
      snapshotsByCanvas.set(canvasId, {
        groups: emptyTodoGroups(),
        taskCount: 0,
        runtime: null,
        status: null,
        error
      });
    }
  }
  return { aggregation, snapshotsByCanvas };
}

export function buildTodoGroupsFromContext(context: ProjectTodoContext): DesktopTodoGroups {
  const { aggregation, snapshotsByCanvas } = context;
  const groups = emptyTodoGroups();
  for (const canvasId of aggregation.orderedCanvasIds) {
    const snapshot = snapshotsByCanvas.get(canvasId);
    if (!snapshot) {
      continue;
    }
    const projectAwareGroups = applyProjectBlockers(aggregation, canvasId, snapshot.groups).groups;
    for (const [groupName, items] of Object.entries(projectAwareGroups) as Array<[keyof DesktopTodoGroups, DesktopTodoItem[]]>) {
      groups[groupName].push(...items);
    }
  }
  return groups;
}

export async function getTodoGroups(projectRoot: string): Promise<DesktopTodoGroups> {
  return buildTodoGroupsFromContext(await loadProjectTodoContext(projectRoot));
}

export function buildProjectExecutionPlanFromContext(context: ProjectTodoContext): DesktopProjectExecutionPlan {
  const { aggregation, snapshotsByCanvas } = context;
  const phases = aggregation.orderedCanvasIds.flatMap((canvasId, index) => {
    const canvas = aggregation.canvasesById.get(canvasId);
    const snapshot = snapshotsByCanvas.get(canvasId);
    if (!canvas || !snapshot) {
      return [];
    }
    const { groups, blockedReadyCount } = applyProjectBlockers(aggregation, canvasId, snapshot.groups);
    return [executionPhaseFromGroups(index + 1, canvasId, canvas.canvasName, snapshot.taskCount, groups, blockedReadyCount)];
  });
  return {
    phases,
    readyQueue: phases.flatMap((phase) => phase.readyQueue),
    notes: aggregation.notes
  };
}

export async function getProjectExecutionPlan(projectRoot: string): Promise<DesktopProjectExecutionPlan> {
  return buildProjectExecutionPlanFromContext(await loadProjectTodoContext(projectRoot));
}
