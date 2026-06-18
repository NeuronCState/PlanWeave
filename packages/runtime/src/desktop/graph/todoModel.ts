import { buildExecutionStatus, type ExecutionStatus } from "../../taskManager/executionStatus.js";
import { createProjectGraphClaimGuardFromAggregation } from "../../taskManager/projectGraphClaimGuard.js";
import { loadRuntime, type RuntimeContext } from "../../taskManager/runtimeContext.js";
import type { DesktopProjectExecutionPhase, DesktopProjectExecutionPlan, DesktopTodoGroups, DesktopTodoItem } from "../types.js";
import type { ValidationIssue } from "../../types.js";
import { appendDesktopDiagnostic, desktopDiagnostic, errorMessage } from "./desktopDiagnostics.js";
import { getBlock } from "./graphHelpers.js";
import {
  loadProjectCanvasAggregation,
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
): { groups: DesktopTodoGroups; projectBlockedReadyCount: number } {
  const { graph, status } = context;
  const taskStatusById = new Map(status.tasks.map((task) => [task.taskId, task.status]));
  const claimHintByRef = new Map(status.claimHints.map((hint) => [hint.ref, hint]));
  const groups = emptyTodoGroups();
  let projectBlockedReadyCount = 0;
  for (const blockStatus of status.blocks) {
    const block = getBlock(graph, blockStatus.ref);
    const claimHint = claimHintByRef.get(blockStatus.ref);
    const dependencyBlockers = claimHint ? [...claimHint.blockedByTasks, ...claimHint.blockedByBlocks, ...claimHint.blockedByProject] : [];
    if (blockStatus.status === "ready" && (claimHint?.blockedByProject.length ?? 0) > 0) {
      projectBlockedReadyCount += 1;
    }
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
  return { groups, projectBlockedReadyCount };
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
  projectBlockedReadyCount: number;
  taskCount: number;
  runtime: RuntimeContext | null;
  status: ExecutionStatus | null;
  error: unknown | null;
};

export type ProjectTodoContext = {
  aggregation: ProjectCanvasAggregationContext;
  snapshotsByCanvas: Map<string, CanvasExecutionSnapshot>;
  diagnostics: ValidationIssue[];
};

function failedCanvasExecutionSnapshot(taskCount: number, error: unknown): CanvasExecutionSnapshot {
  return {
    groups: emptyTodoGroups(),
    projectBlockedReadyCount: 0,
    taskCount,
    runtime: null,
    status: null,
    error
  };
}

async function canvasExecutionSnapshot(
  aggregation: ProjectCanvasAggregationContext,
  canvasId: string,
  runtime: RuntimeContext | undefined
): Promise<CanvasExecutionSnapshot> {
  const canvas = aggregation.canvasesById.get(canvasId);
  if (!canvas) {
    throw new Error(`Project canvas '${canvasId}' is missing from aggregation.`);
  }
  let canvasRuntime: RuntimeContext;
  let status: ExecutionStatus;
  try {
    canvasRuntime = runtime ?? await loadRuntime({ projectRoot: canvas.workspace });
    status = await buildExecutionStatus(canvasRuntime, {
      claimGuard: createProjectGraphClaimGuardFromAggregation(canvasRuntime, aggregation)
    });
  } catch (error) {
    throw new Error(`Canvas '${canvasId}' execution snapshot failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const { groups, projectBlockedReadyCount } = buildTodoGroupsForRuntime({ ...canvasRuntime, status }, {
    canvasId,
    canvasName: canvas.canvasName
  });
  return {
    groups,
    projectBlockedReadyCount,
    taskCount: canvasRuntime.graph.taskNodesInManifestOrder.length,
    runtime: canvasRuntime,
    status,
    error: null
  };
}

export async function loadProjectTodoContext(projectRoot: string): Promise<ProjectTodoContext> {
  const runtimesByCanvas = new Map<string, RuntimeContext>();
  const diagnostics: ValidationIssue[] = [];
  const aggregation = await loadProjectCanvasAggregation(projectRoot, {
    loadRuntimeSnapshot: async (workspace, canvasId) => {
      const runtime = await loadRuntime({ projectRoot: workspace });
      runtimesByCanvas.set(canvasId, runtime);
      return runtimeSnapshotFromGraphState(runtime.graph, runtime.state);
    }
  });
  const snapshotsByCanvas = new Map<string, CanvasExecutionSnapshot>();

  for (const canvasId of aggregation.orderedCanvasIds) {
    const canvas = aggregation.canvasesById.get(canvasId);
    try {
      snapshotsByCanvas.set(canvasId, await canvasExecutionSnapshot(aggregation, canvasId, runtimesByCanvas.get(canvasId)));
    } catch (caught) {
      appendDesktopDiagnostic(
        diagnostics,
        desktopDiagnostic("desktop_canvas_execution_snapshot_failed", errorMessage(caught), canvasId)
      );
      snapshotsByCanvas.set(canvasId, failedCanvasExecutionSnapshot(canvas?.canvas.taskCount ?? 0, caught));
    }
  }
  return { aggregation, snapshotsByCanvas, diagnostics };
}

export function buildTodoGroupsFromContext(context: ProjectTodoContext): DesktopTodoGroups {
  const { aggregation, snapshotsByCanvas } = context;
  const groups = emptyTodoGroups();
  for (const canvasId of aggregation.orderedCanvasIds) {
    const snapshot = snapshotsByCanvas.get(canvasId);
    if (!snapshot) {
      continue;
    }
    for (const [groupName, items] of Object.entries(snapshot.groups) as Array<[keyof DesktopTodoGroups, DesktopTodoItem[]]>) {
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
    return [executionPhaseFromGroups(index + 1, canvasId, canvas.canvasName, snapshot.taskCount, snapshot.groups, snapshot.projectBlockedReadyCount)];
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
