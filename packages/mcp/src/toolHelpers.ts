import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { DesktopProjectSummary, GraphEditResult, RuntimeSchemaTopicName, ValidationReport } from "@planweave-ai/runtime";
import type { ExportedPlanPackageFile } from "./toolTypes.js";

export type ProjectArgs = {
  projectId: string;
};

export type ProjectCanvasArgs = ProjectArgs & {
  canvasId?: string;
};

export function jsonToolResult(value: Record<string, unknown>): CallToolResult {
  return {
    structuredContent: value,
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

export function sanitizeProject(project: DesktopProjectSummary) {
  return {
    projectId: project.projectId,
    name: project.name,
    activeCanvasId: project.activeCanvasId,
    taskCanvases: project.taskCanvases
  };
}

export function summarizeGraphEdit(result: GraphEditResult) {
  return {
    ok: result.ok,
    affectedTasks: result.affectedTasks,
    diagnostics: result.diagnostics
  };
}

export function explainValidationReport(report: ValidationReport) {
  const issues = [
    ...report.errors.map((issue) => ({ severity: "error", ...issue })),
    ...report.warnings.map((issue) => ({ severity: "warning", ...issue }))
  ];
  return {
    ok: report.ok,
    issues,
    explanations: issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      path: issue.path ?? null,
      explanation: issue.message,
      suggestedAction: suggestionForValidationIssue(issue.code, issue.message)
    }))
  };
}

export function readObjectArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Tool arguments must be an object.");
  }
  return args as Record<string, unknown>;
}

export function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

export function optionalNonEmptyString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return nonEmptyString(value, field);
}

export function optionalNullableString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === "") {
    return null;
  }
  return nonEmptyString(value, field);
}

export function optionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array of strings.`);
  }
  return value.map((item, index) => nonEmptyString(item, `${field}[${index}]`));
}

export function parseProjectArgs(args: unknown): ProjectArgs {
  const record = readObjectArgs(args);
  return { projectId: nonEmptyString(record.projectId, "projectId") };
}

export function parseProjectCanvasArgs(args: unknown): ProjectCanvasArgs {
  const record = readObjectArgs(args);
  return {
    projectId: nonEmptyString(record.projectId, "projectId"),
    canvasId: optionalNonEmptyString(record.canvasId, "canvasId")
  };
}

export function blockRefFromArgs(record: Record<string, unknown>): string {
  const blockRef = optionalNonEmptyString(record.blockRef, "blockRef");
  const taskId = optionalNonEmptyString(record.taskId, "taskId");
  const blockId = optionalNonEmptyString(record.blockId, "blockId");
  if (!blockRef && (!taskId || !blockId)) {
    throw new Error("blockRef is required unless taskId and blockId are provided.");
  }
  return blockRef ?? `${taskId}#${blockId}`;
}

export function parseGetSchemaArgs(args: unknown): { topic?: RuntimeSchemaTopicName } {
  if (args === undefined || args === null) {
    return {};
  }
  if (typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Tool arguments must be an object.");
  }
  const topic = (args as { topic?: unknown }).topic;
  if (topic === undefined || topic === null || topic === "") {
    return {};
  }
  if (topic !== "manifest" && topic !== "project") {
    throw new Error("topic must be one of: manifest, project.");
  }
  return { topic };
}

export function parsePackageFiles(value: unknown): ExportedPlanPackageFile[] {
  if (!Array.isArray(value)) {
    throw new Error("files must be an array.");
  }
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`files[${index}] must be an object.`);
    }
    const record = item as Record<string, unknown>;
    const encoding = record.encoding ?? "utf8";
    if (encoding !== "utf8") {
      throw new Error(`files[${index}].encoding must be utf8.`);
    }
    return {
      path: nonEmptyString(record.path, `files[${index}].path`),
      content: typeof record.content === "string" ? record.content : nonEmptyString(record.content, `files[${index}].content`),
      encoding
    };
  });
}

function suggestionForValidationIssue(code: string, message: string): string {
  if (code.includes("prompt")) {
    return "Use read_prompt and the relevant write_*_prompt tool to repair the missing or invalid prompt content.";
  }
  if (code.includes("dependency") || message.toLowerCase().includes("cycle")) {
    return "Inspect preview_execution_graph, then use add_dependency or remove_dependency to make the DAG valid.";
  }
  if (code.includes("manifest")) {
    return "Use get_schema and graph edit tools instead of editing manifest structure directly.";
  }
  return "Open the referenced project, inspect the affected task or block, then apply the smallest matching write tool.";
}
