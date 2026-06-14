import { readJsonFile } from "../../json.js";
import {
  loadProjectCanvasRuntimeAggregation,
  projectBlockersForTask,
  projectGraphDiagnosticNote,
  type ProjectCanvasRuntimeAggregationContext,
  type ProjectCanvasRuntimeContext,
  type ProjectCanvasRuntimeSnapshot
} from "../../projectGraph/runtimeAggregation.js";
import type { ProjectCanvasNode } from "../../projectGraph/index.js";
import type { ProjectWorkspace, ValidationIssue } from "../../types.js";
import { canvasDiagnostics } from "../canvasDiagnostics.js";
import type { DesktopTaskCanvasSummary } from "../types.js";

export type ProjectTaskCanvasContext = {
  canvasId: string;
  canvasName: string;
  canvas: DesktopTaskCanvasSummary;
  workspace: ProjectWorkspace;
};

export type ProjectCanvasAggregationCanvas = ProjectTaskCanvasContext & ProjectCanvasRuntimeContext;

export type ProjectCanvasAggregationContext = Omit<ProjectCanvasRuntimeAggregationContext, "canvases" | "canvasesById"> & {
  canvases: ProjectCanvasAggregationCanvas[];
  canvasesById: Map<string, ProjectCanvasAggregationCanvas>;
};

export type { ProjectCanvasRuntimeSnapshot };
export { projectBlockersForTask };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

async function taskCount(workspace: ProjectWorkspace): Promise<number> {
  try {
    const raw = asRecord(await readJsonFile<unknown>(workspace.manifestFile));
    const nodes = Array.isArray(raw?.nodes) ? raw.nodes : [];
    return nodes.filter((node) => asRecord(node)?.type === "task").length;
  } catch {
    return 0;
  }
}

async function canvasSummary(workspace: ProjectWorkspace, canvas: ProjectCanvasNode): Promise<DesktopTaskCanvasSummary> {
  const diagnostics = await canvasDiagnostics(workspace);
  return {
    canvasId: canvas.id,
    name: canvas.title,
    taskCount: await taskCount(workspace),
    missingPromptCount: diagnostics.filter((diagnostic) => diagnostic.code === "prompt_missing").length,
    diagnostics,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}

export function projectCanvasDiagnosticNote(diagnostic: ValidationIssue): string {
  return projectGraphDiagnosticNote(diagnostic);
}

export async function loadProjectCanvasAggregation(projectRootOrWorkspace: string | ProjectWorkspace): Promise<ProjectCanvasAggregationContext> {
  const runtime = await loadProjectCanvasRuntimeAggregation(projectRootOrWorkspace);
  const canvases: ProjectCanvasAggregationCanvas[] = [];
  const canvasesById = new Map<string, ProjectCanvasAggregationCanvas>();

  for (const runtimeCanvas of runtime.canvases) {
    const context: ProjectCanvasAggregationCanvas = {
      ...runtimeCanvas,
      canvas: await canvasSummary(runtimeCanvas.workspace, runtimeCanvas.projectCanvas)
    };
    canvases.push(context);
    canvasesById.set(context.canvasId, context);
  }

  return { ...runtime, canvases, canvasesById };
}

function hasPackageDiagnostics(canvas: DesktopTaskCanvasSummary): boolean {
  return canvas.diagnostics.some((diagnostic) => diagnostic.code === "manifest_schema" || diagnostic.code === "manifest_read_failed");
}

export async function mapProjectTaskCanvases<T>(
  projectRoot: string,
  mapper: (context: ProjectTaskCanvasContext, index: number) => Promise<T>
): Promise<T[]> {
  const context = await loadProjectCanvasAggregation(projectRoot);
  const results: T[] = [];
  for (const canvas of context.canvases) {
    if (hasPackageDiagnostics(canvas.canvas)) {
      continue;
    }
    results.push(await mapper(canvas, results.length));
  }
  return results;
}
