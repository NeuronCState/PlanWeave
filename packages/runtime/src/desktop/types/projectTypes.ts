import type { ValidationIssue } from "../../types.js";

export type DesktopTaskCanvasSummary = {
  canvasId: string;
  name: string;
  taskCount: number;
  missingPromptCount: number;
  diagnostics: ValidationIssue[];
  createdAt: string;
  updatedAt: string;
};

export type DesktopProjectSummary = {
  projectId: string;
  name: string;
  rootPath: string;
  workspaceRoot: string;
  taskCanvases: DesktopTaskCanvasSummary[];
};
