import type { ProjectWorkspace, ValidationIssue } from "../types.js";
import { canvasDiagnosticsFromPackage } from "./canvasSummaryModel.js";

export async function canvasDiagnostics(workspace: ProjectWorkspace): Promise<ValidationIssue[]> {
  return canvasDiagnosticsFromPackage(workspace);
}
