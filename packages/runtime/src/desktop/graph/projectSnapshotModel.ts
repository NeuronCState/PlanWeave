import { resolve } from "node:path";
import { readProjectPrompt, readProjectPromptPolicy } from "../../projectPromptPolicy.js";
import { getDesktopLayout, getDesktopLayoutForPackage } from "../layoutApi.js";
import { resolveTaskCanvasWorkspace } from "../canvasApi.js";
import type { ProjectWorkspace } from "../../types.js";
import type { DesktopCanvasReference, DesktopProjectSnapshot } from "../types.js";
import {
  buildDesktopGraphViewModelContext,
  buildGraphViewModel,
  loadDesktopGraphViewModelContext,
  type DesktopGraphViewModelContext
} from "./readModel.js";
import { buildStatisticsFromProjectTodoContext } from "./statisticsModel.js";
import { buildProjectExecutionPlanFromContext, buildTodoGroupsFromContext, loadProjectTodoContext, type ProjectTodoContext } from "./todoModel.js";

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

async function captureSnapshotPart<T>(
  errors: string[],
  label: string,
  load: () => Promise<T>
): Promise<T | null> {
  try {
    return await load();
  } catch (caught) {
    errors.push(`${label}: ${errorMessage(caught)}`);
    return null;
  }
}

type SelectedWorkspaceResult =
  | { ok: true; workspace: Awaited<ReturnType<typeof resolveTaskCanvasWorkspace>> }
  | { ok: false; error: unknown };

type SnapshotResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

async function captureResult<T>(load: () => Promise<T>): Promise<SnapshotResult<T>> {
  try {
    return { ok: true, value: await load() };
  } catch (error) {
    return { ok: false, error };
  }
}

function unwrapSnapshotResult<T>(result: SnapshotResult<T>): T {
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

function sameWorkspace(left: ProjectWorkspace, right: ProjectWorkspace): boolean {
  return resolve(left.packageDir) === resolve(right.packageDir)
    && resolve(left.stateFile) === resolve(right.stateFile)
    && resolve(left.resultsDir) === resolve(right.resultsDir);
}

function selectedGraphContextFromProjectTodoContext(
  context: ProjectTodoContext,
  selectedWorkspace: ProjectWorkspace
): DesktopGraphViewModelContext {
  const canvas = context.aggregation.canvases.find((candidate) => sameWorkspace(candidate.workspace, selectedWorkspace));
  if (!canvas) {
    throw new Error("Selected task canvas is not listed in project aggregation.");
  }
  const snapshot = context.snapshotsByCanvas.get(canvas.canvasId);
  if (!snapshot) {
    throw new Error(`Selected task canvas '${canvas.canvasId}' execution snapshot is missing.`);
  }
  if (snapshot.error) {
    throw new Error(`Selected task canvas '${canvas.canvasId}' execution snapshot failed: ${errorMessage(snapshot.error)}`);
  }
  if (!snapshot.runtime || !snapshot.status) {
    throw new Error(`Selected task canvas '${canvas.canvasId}' execution status is unavailable.`);
  }
  return buildDesktopGraphViewModelContext(snapshot.runtime, snapshot.status);
}

export async function getDesktopProjectSnapshot(ref: DesktopCanvasReference): Promise<DesktopProjectSnapshot> {
  const errors: string[] = [];
  const selectedWorkspace: SelectedWorkspaceResult = await resolveTaskCanvasWorkspace(ref.projectRoot, ref.canvasId)
    .then((workspace) => ({ ok: true, workspace }) as const)
    .catch((error: unknown) => ({ ok: false, error }) as const);
  const getSelectedWorkspace = () => {
    if (!selectedWorkspace.ok) {
      throw selectedWorkspace.error;
    }
    return selectedWorkspace.workspace;
  };
  const projectTodoContext: SnapshotResult<ProjectTodoContext> = await captureResult(() => loadProjectTodoContext(ref.projectRoot));
  const selectedGraphContext: SnapshotResult<DesktopGraphViewModelContext> = selectedWorkspace.ok
    ? projectTodoContext.ok
      ? await captureResult(async () => selectedGraphContextFromProjectTodoContext(projectTodoContext.value, selectedWorkspace.workspace))
      : await captureResult(() => loadDesktopGraphViewModelContext(selectedWorkspace.workspace))
    : { ok: false, error: selectedWorkspace.error };

  const [
    projectPromptMarkdown,
    projectPromptPolicy,
    graph,
    layout,
    todoGroups,
    executionPlan,
    statistics
  ] = await Promise.all([
    captureSnapshotPart(errors, "projectPromptMarkdown", () => readProjectPrompt(ref.projectRoot)),
    captureSnapshotPart(errors, "projectPromptPolicy", () => readProjectPromptPolicy(ref.projectRoot)),
    captureSnapshotPart(errors, "graph", async () => buildGraphViewModel(unwrapSnapshotResult(selectedGraphContext))),
    captureSnapshotPart(errors, "layout", async () => {
      if (selectedGraphContext.ok) {
        return getDesktopLayoutForPackage(selectedGraphContext.value.workspace, selectedGraphContext.value.manifest);
      }
      return getDesktopLayout(getSelectedWorkspace());
    }),
    captureSnapshotPart(errors, "todoGroups", async () => buildTodoGroupsFromContext(unwrapSnapshotResult(projectTodoContext))),
    captureSnapshotPart(errors, "executionPlan", async () => buildProjectExecutionPlanFromContext(unwrapSnapshotResult(projectTodoContext))),
    captureSnapshotPart(errors, "statistics", async () => buildStatisticsFromProjectTodoContext(unwrapSnapshotResult(projectTodoContext)))
  ]);

  return {
    projectPromptMarkdown,
    projectPromptPolicy,
    graph,
    layout,
    todoGroups,
    executionPlan,
    statistics,
    errors
  };
}
