import { parseBlockRef } from "../../graph/compileTaskGraph.js";
import { compileTaskGraph } from "../../graph/compileTaskGraph.js";
import { loadPackage } from "../../package/loadPackage.js";
import { resolvePackagePath } from "../../package/resolvePackagePath.js";
import { getExecutionStatus, renderPromptSurface } from "../../taskManager/index.js";
import { buildExecutionStatus, type ExecutionStatus } from "../../taskManager/executionStatus.js";
import { loadRuntime, type RuntimeContext } from "../../taskManager/runtimeContext.js";
import { listExecutorProfilesForManifest } from "../../autoRun/executors.js";
import { buildPlanGraphViewProjection, loadPlanGraphPackage } from "../../plangraph/index.js";
import type { PackageWorkspaceRef, ValidationIssue } from "../../types.js";
import type { DesktopBlockDetail, DesktopGraphViewModel, DesktopTaskDetail, DesktopTaskExecutionOrder } from "../types.js";
import { getDirtyPromptRefs } from "../fileSyncApi.js";
import { getBlock, getTask, readOptionalFile, sortBlockRefsForTask } from "./graphHelpers.js";

export type DesktopGraphViewModelContext = RuntimeContext & {
  status: ExecutionStatus;
  executorOptions: string[];
};

function appendDiagnostic(diagnostics: ValidationIssue[], diagnostic: ValidationIssue | null): void {
  if (!diagnostic) {
    return;
  }
  if (diagnostics.some((item) => item.code === diagnostic.code && item.path === diagnostic.path && item.message === diagnostic.message)) {
    return;
  }
  diagnostics.push(diagnostic);
}

export async function loadDesktopGraphViewModelContext(projectRoot: PackageWorkspaceRef): Promise<DesktopGraphViewModelContext> {
  const runtime = await loadRuntime({ projectRoot });
  return buildDesktopGraphViewModelContext(runtime, await buildExecutionStatus(runtime));
}

export function buildDesktopGraphViewModelContext(runtime: RuntimeContext, status: ExecutionStatus): DesktopGraphViewModelContext {
  return {
    ...runtime,
    status,
    executorOptions: listExecutorProfilesForManifest(runtime.manifest).map((profile) => profile.name)
  };
}

export async function buildGraphViewModel(context: DesktopGraphViewModelContext): Promise<DesktopGraphViewModel> {
  const { workspace, status, executorOptions } = context;
  const planGraphPackage = await loadPlanGraphPackage(workspace);
  const dirtyPromptRefs = await getDirtyPromptRefs(workspace);
  const diagnostics = [...planGraphPackage.graph.diagnostics];
  const taskPromptMarkdownById = new Map<string, string>();
  for (const task of planGraphPackage.graph.tasks.values()) {
    const taskPrompt = await readOptionalFile(await resolvePackagePath(workspace.packageDir, task.promptRef.path), task.promptRef.path);
    appendDiagnostic(diagnostics, taskPrompt.diagnostic);
    taskPromptMarkdownById.set(task.taskId, taskPrompt.markdown);
    for (const blockRef of task.blockRefs) {
      const block = planGraphPackage.graph.blocks.get(blockRef);
      if (!block) {
        continue;
      }
      const blockPrompt = await readOptionalFile(await resolvePackagePath(workspace.packageDir, block.promptRef.path), block.promptRef.path);
      appendDiagnostic(diagnostics, blockPrompt.diagnostic);
    }
  }
  const projection = buildPlanGraphViewProjection({
    graph: planGraphPackage.graph,
    runtime: context,
    status,
    taskPromptMarkdownById
  });

  return {
    projectId: workspace.id,
    projectTitle: planGraphPackage.graph.project.title,
    graphVersion: planGraphPackage.graph.graphVersion,
    packageFingerprint: planGraphPackage.graph.packageFingerprint,
    executorOptions,
    tasks: projection.tasks,
    edges: projection.edges,
    diagnostics,
    dirtyPromptRefs
  };
}

export async function getGraphViewModel(projectRoot: PackageWorkspaceRef): Promise<DesktopGraphViewModel> {
  return buildGraphViewModel(await loadDesktopGraphViewModelContext(projectRoot));
}

export async function getTaskDetail(projectRoot: PackageWorkspaceRef, taskId: string): Promise<DesktopTaskDetail> {
  const { workspace, manifest } = await loadPackage(projectRoot);
  const graph = compileTaskGraph(manifest);
  const planGraphPackage = await loadPlanGraphPackage(workspace);
  const task = getTask(graph, taskId);
  const status = await getExecutionStatus({ projectRoot });
  const prompt = await readOptionalFile(await resolvePackagePath(workspace.packageDir, task.prompt), task.prompt);
  return {
    taskId,
    graphVersion: planGraphPackage.graph.graphVersion,
    title: task.title,
    status: status.tasks.find((item) => item.taskId === taskId)?.status ?? "planned",
    executor: task.executor ?? null,
    promptMarkdown: prompt.markdown,
    promptHash: planGraphPackage.graph.tasks.get(taskId)?.promptRef.contentHash ?? "",
    promptMissing: prompt.missing,
    acceptance: task.acceptance,
    blockOrder: sortBlockRefsForTask(graph, taskId)
  };
}

export async function getTaskExecutionOrder(projectRoot: PackageWorkspaceRef, taskId: string): Promise<DesktopTaskExecutionOrder> {
  const { manifest } = await loadPackage(projectRoot);
  const graph = compileTaskGraph(manifest);
  getTask(graph, taskId);
  return {
    taskId,
    blockRefs: sortBlockRefsForTask(graph, taskId)
  };
}

export async function getBlockDetail(projectRoot: PackageWorkspaceRef, ref: string): Promise<DesktopBlockDetail> {
  const { workspace, manifest } = await loadPackage(projectRoot);
  const graph = compileTaskGraph(manifest);
  const planGraphPackage = await loadPlanGraphPackage(workspace);
  const { taskId, blockId } = parseBlockRef(ref);
  const task = getTask(graph, taskId);
  const block = getBlock(graph, ref);
  const status = await getExecutionStatus({ projectRoot });
  const blockStatus = status.blocks.find((item) => item.ref === ref);
  const claimHint = status.claimHints.find((item) => item.ref === ref);
  const prompt = await readOptionalFile(await resolvePackagePath(workspace.packageDir, block.prompt), block.prompt);
  const promptSurface = await renderPromptSurface({
    projectRoot,
    ref,
    allowMissingPromptSources: true
  });
  return {
    ref,
    graphVersion: planGraphPackage.graph.graphVersion,
    taskId,
    blockId,
    type: block.type,
    title: block.title,
    status: blockStatus?.status ?? "planned",
    executor: block.executor ?? null,
    effectiveExecutor: block.executor ?? task.executor ?? manifest.execution.defaultExecutor ?? null,
    promptMarkdown: prompt.markdown,
    promptHash: planGraphPackage.graph.blocks.get(ref)?.promptRef.contentHash ?? "",
    promptMissing: prompt.missing,
    promptSurfaceMarkdown: promptSurface.markdown,
    promptSources: promptSurface.sources,
    dependencies: graph.blockDependenciesByRef.get(ref) ?? [],
    latestRunId: blockStatus?.lastRunId ?? null,
    latestReviewAttemptId: blockStatus?.latestReviewAttemptId ?? null,
    activeFeedbackId: blockStatus?.activeFeedbackId ?? null,
    exceptionReason: blockStatus?.reason ?? null,
    reviewGate: claimHint?.reviewGate ?? null
  };
}
