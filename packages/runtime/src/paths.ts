import { homedir } from "node:os";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { getActiveTaskCanvasId, resolveTaskCanvasWorkspace } from "./desktop/canvasApi.js";
import { resolveProjectWorkspace } from "./project.js";
import { loadProjectGraph, projectCanvasWorkspace, projectGraphPath } from "./projectGraph/index.js";
import type { ProjectPathsResult } from "./types.js";

export function resolvePlanweaveHome(): string {
  return process.env.PLANWEAVE_HOME ? resolve(process.env.PLANWEAVE_HOME) : join(homedir(), ".planweave");
}

export async function readProjectPaths(projectRoot: string): Promise<ProjectPathsResult> {
  const projectWorkspace = await resolveProjectWorkspace(projectRoot);
  try {
    await access(projectWorkspace.projectFile, constants.R_OK);
  } catch {
    throw new Error(`PlanWeave workspace for project '${projectWorkspace.rootPath}' has not been initialized.`);
  }
  const workspace = await resolveTaskCanvasWorkspace(projectRoot);
  const loadedProjectGraph = await loadProjectGraph(projectRoot);
  const canvases = loadedProjectGraph.manifest.canvases.map((canvas) => {
    const canvasWorkspace = projectCanvasWorkspace(loadedProjectGraph.workspace, canvas);
    return {
      canvasId: canvas.id,
      name: canvas.title,
      packageDir: canvasWorkspace.packageDir,
      statePath: canvasWorkspace.stateFile,
      resultsDir: canvasWorkspace.resultsDir
    };
  });

  return {
    workspaceDir: resolvePlanweaveHome(),
    projectId: workspace.id,
    projectDir: projectWorkspace.workspaceRoot,
    projectGraphPath: projectGraphPath(projectWorkspace),
    packageDir: workspace.packageDir,
    statePath: workspace.stateFile,
    resultsDir: workspace.resultsDir,
    activeCanvasId: await getActiveTaskCanvasId(projectRoot),
    canvases
  };
}
