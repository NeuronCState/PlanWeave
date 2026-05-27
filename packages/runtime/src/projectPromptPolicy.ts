import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readJsonFile, writeJsonFile } from "./json.js";
import { resolveProjectWorkspace } from "./project.js";
import type { PackageWorkspaceRef, ProjectWorkspace } from "./types.js";

export type ProjectPromptPolicy = {
  includeGlobalPrompt: boolean;
};

const defaultProjectPromptPolicy: ProjectPromptPolicy = {
  includeGlobalPrompt: true
};

async function resolvePolicyWorkspace(projectRoot: PackageWorkspaceRef): Promise<ProjectWorkspace> {
  const workspace = typeof projectRoot === "string" ? await resolveProjectWorkspace(projectRoot) : projectRoot;
  return resolveProjectWorkspace(workspace.rootPath);
}

function projectPromptPolicyPath(workspace: ProjectWorkspace): string {
  return join(workspace.workspaceRoot, "policy", "prompt-policy.json");
}

function normalizeProjectPromptPolicy(raw: unknown): ProjectPromptPolicy {
  if (raw === undefined || raw === null) {
    return defaultProjectPromptPolicy;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Project prompt policy must be a JSON object.");
  }
  const value = raw as Record<string, unknown>;
  if (value.includeGlobalPrompt !== undefined && typeof value.includeGlobalPrompt !== "boolean") {
    throw new Error("Project prompt policy field 'includeGlobalPrompt' must be a boolean.");
  }
  return {
    includeGlobalPrompt: value.includeGlobalPrompt ?? defaultProjectPromptPolicy.includeGlobalPrompt
  };
}

function fileErrorCode(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : null;
}

export async function readProjectPromptPolicy(projectRoot: PackageWorkspaceRef): Promise<ProjectPromptPolicy> {
  const workspace = await resolvePolicyWorkspace(projectRoot);
  const path = projectPromptPolicyPath(workspace);
  try {
    return normalizeProjectPromptPolicy(await readJsonFile<unknown>(path));
  } catch (error) {
    if (fileErrorCode(error) === "ENOENT") {
      return defaultProjectPromptPolicy;
    }
    throw error;
  }
}

export async function updateProjectPromptPolicy(
  projectRoot: PackageWorkspaceRef,
  patch: Partial<ProjectPromptPolicy>
): Promise<ProjectPromptPolicy> {
  const workspace = await resolvePolicyWorkspace(projectRoot);
  const next = normalizeProjectPromptPolicy({
    ...(await readProjectPromptPolicy(workspace)),
    ...patch
  });
  await writeJsonFile(projectPromptPolicyPath(workspace), next);
  return next;
}

export async function readProjectPrompt(projectRoot: PackageWorkspaceRef): Promise<string> {
  const workspace = await resolvePolicyWorkspace(projectRoot);
  try {
    return await readFile(workspace.projectPromptFile, "utf8");
  } catch (error) {
    if (fileErrorCode(error) === "ENOENT") {
      return "";
    }
    throw error;
  }
}

export async function updateProjectPrompt(projectRoot: PackageWorkspaceRef, markdown: string): Promise<string> {
  const workspace = await resolvePolicyWorkspace(projectRoot);
  await mkdir(dirname(workspace.projectPromptFile), { recursive: true });
  await writeFile(workspace.projectPromptFile, markdown, "utf8");
  return markdown;
}
