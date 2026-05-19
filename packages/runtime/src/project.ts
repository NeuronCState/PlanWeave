import { access, realpath } from "node:fs/promises";
import { join } from "node:path";
import { constants } from "node:fs";
import { createProjectId } from "./projectId.js";
import { resolvePlanweaveHome } from "./paths.js";
import { readJsonFile } from "./json.js";
import type { ProjectMetadata, ProjectWorkspace } from "./types.js";

export async function resolveProjectWorkspace(projectRoot: string): Promise<ProjectWorkspace> {
  const rootPath = await realpath(projectRoot);
  const id = await createProjectId(rootPath);
  const workspaceRoot = join(resolvePlanweaveHome(), "projects", id);
  return {
    id,
    rootPath,
    workspaceRoot,
    projectFile: join(workspaceRoot, "project.json"),
    packageDir: join(workspaceRoot, "package"),
    manifestFile: join(workspaceRoot, "package", "manifest.json"),
    stateFile: join(workspaceRoot, "state.json"),
    resultsDir: join(workspaceRoot, "results")
  };
}

export async function readProject(projectRoot: string): Promise<ProjectMetadata | null> {
  const workspace = await resolveProjectWorkspace(projectRoot);
  try {
    await access(workspace.projectFile, constants.R_OK);
  } catch {
    return null;
  }
  return readJsonFile<ProjectMetadata>(workspace.projectFile);
}
