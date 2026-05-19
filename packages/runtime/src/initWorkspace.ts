import { access, mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { constants } from "node:fs";
import { resolveProjectWorkspace } from "./project.js";
import { createEmptyState } from "./state.js";
import { writeJsonFile } from "./json.js";
import type { InitWorkspaceResult, PlanPackageManifest, ProjectMetadata } from "./types.js";

function initialManifest(projectName: string): PlanPackageManifest {
  return {
    version: "plan-package/v0",
    project: {
      title: projectName,
      description: ""
    },
    execution: {
      parallel: {
        enabled: false,
        maxConcurrent: 1
      }
    },
    global_prompt: "global-prompt.md",
    nodes: [],
    edges: []
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function initWorkspace(options: {
  projectRoot: string;
  force?: boolean;
}): Promise<InitWorkspaceResult> {
  const rootPath = await realpath(options.projectRoot);
  const workspace = await resolveProjectWorkspace(rootPath);
  const projectName = basename(rootPath);
  const project: ProjectMetadata = {
    id: workspace.id,
    name: projectName,
    rootPath,
    createdAt: new Date().toISOString()
  };

  const alreadyExists = await exists(workspace.projectFile);
  await mkdir(join(workspace.packageDir, "nodes"), { recursive: true });
  await mkdir(workspace.resultsDir, { recursive: true });

  if (!alreadyExists || options.force) {
    await writeJsonFile(workspace.projectFile, project);
    await writeJsonFile(workspace.manifestFile, initialManifest(projectName));
    await writeFile(join(workspace.packageDir, "global-prompt.md"), "# Global Prompt\n", "utf8");
    await writeJsonFile(workspace.stateFile, createEmptyState());
  }

  return {
    workspace,
    project,
    created: !alreadyExists
  };
}
