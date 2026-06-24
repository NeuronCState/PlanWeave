import type { DesktopProjectSummary } from "@planweave-ai/runtime";

export type AgentPromptScope = {
  project: Pick<DesktopProjectSummary, "projectId" | "rootPath" | "sourceRoot">;
  canvasId: string;
  taskId?: string | null;
};

export function buildAgentScopePrompt({ project, canvasId, taskId }: AgentPromptScope): string {
  const lines = [
    `projectId: ${project.projectId}`,
    `projectRoot: ${project.rootPath}`,
    `canvasId: ${canvasId}`,
    `sourceRoot: ${project.sourceRoot ?? ""}`
  ];
  if (taskId) {
    lines.push(`task_id: ${taskId}`);
  }
  return lines.join("\n");
}

export async function writeAgentScopePromptToClipboard(scope: AgentPromptScope): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard API is not available.");
  }
  await navigator.clipboard.writeText(buildAgentScopePrompt(scope));
}
