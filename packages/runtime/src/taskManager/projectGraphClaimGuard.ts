import {
  currentProjectCanvasForWorkspace,
  loadProjectCanvasRuntimeAggregation,
  projectBlockerReasonForTask,
  projectGraphDiagnosticNote
} from "../projectGraph/runtimeAggregation.js";
import type { ValidationIssue } from "../types.js";
import type { RuntimeContext } from "./runtimeContext.js";

export type ProjectGraphClaimGuard = {
  blockerReasonForTask(taskId: string): string | null;
};

const noProjectGraphBlockers: ProjectGraphClaimGuard = {
  blockerReasonForTask: () => null
};

function issueDisplayName(issue: ValidationIssue): string {
  return projectGraphDiagnosticNote(issue);
}

export async function createProjectGraphClaimGuard(context: RuntimeContext): Promise<ProjectGraphClaimGuard> {
  const aggregation = await loadProjectCanvasRuntimeAggregation(context.workspace);
  if (aggregation.loaded.source !== "project_graph") {
    return noProjectGraphBlockers;
  }
  if (aggregation.graph.diagnostics.errors.length > 0) {
    const reason = [
      "Project graph is invalid; no task canvas work can be claimed.",
      ...aggregation.graph.diagnostics.errors.map((error) => `- ${issueDisplayName(error)}`)
    ].join("\n");
    return { blockerReasonForTask: () => reason };
  }
  const currentCanvas = currentProjectCanvasForWorkspace(aggregation, context.workspace);
  if (!currentCanvas) {
    return {
      blockerReasonForTask: () => "Current task canvas is not listed in project-graph.json."
    };
  }

  return {
    blockerReasonForTask: (taskId: string) => projectBlockerReasonForTask(aggregation, currentCanvas.canvasId, taskId)
  };
}
