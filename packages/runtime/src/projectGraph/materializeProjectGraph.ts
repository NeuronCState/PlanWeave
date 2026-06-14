import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { loadProjectGraph } from "./loadProjectGraph.js";
import { projectGraphPath, writeProjectGraph } from "./loadProjectGraph.js";
import { resolveProjectWorkspace } from "../project.js";
import type { ProjectGraphSource } from "./types.js";

export type MaterializeProjectGraphResult = {
  path: string;
  created: boolean;
  source: ProjectGraphSource;
  canvasCount: number;
};

async function assertInitializedWorkspace(projectRoot: string): Promise<void> {
  const workspace = await resolveProjectWorkspace(projectRoot);
  try {
    await Promise.all([access(workspace.projectFile, constants.R_OK), access(workspace.manifestFile, constants.R_OK), access(workspace.stateFile, constants.R_OK)]);
  } catch {
    throw new Error(`PlanWeave workspace has not been initialized. Run 'planweave init --project-graph --json' first.`);
  }
}

export async function materializeProjectGraph(projectRoot: string): Promise<MaterializeProjectGraphResult> {
  await assertInitializedWorkspace(projectRoot);
  const loaded = await loadProjectGraph(projectRoot);
  const path = projectGraphPath(loaded.workspace);
  if (loaded.source === "project_graph") {
    return {
      path,
      created: false,
      source: loaded.source,
      canvasCount: loaded.manifest.canvases.length
    };
  }
  await writeProjectGraph(loaded.workspace, loaded.manifest);
  return {
    path,
    created: true,
    source: loaded.source,
    canvasCount: loaded.manifest.canvases.length
  };
}
