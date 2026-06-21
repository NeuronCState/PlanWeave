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
  kind: "external" | "managed";
  rootPath: string;
  sourceRoot: string | null;
  workspaceRoot: string;
  activeCanvasId: string | null;
  taskCanvases: DesktopTaskCanvasSummary[];
};
