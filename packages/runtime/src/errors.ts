import { join } from "node:path";
import type { ProjectWorkspace } from "./types.js";

export class PlanWeaveWorkspaceNotInitializedError extends Error {
  readonly projectRoot: string;
  readonly workspaceDir: string;
  readonly projectId: string;
  readonly projectDir: string;
  readonly projectGraphPath: string;
  readonly packageDir: string;
  readonly statePath: string;
  readonly resultsDir: string;

  constructor(workspace: ProjectWorkspace) {
    super(`PlanWeave workspace for project '${workspace.rootPath}' has not been initialized.`);
    this.name = "PlanWeaveWorkspaceNotInitializedError";
    this.projectRoot = workspace.rootPath;
    this.workspaceDir = workspace.planweaveHome;
    this.projectId = workspace.id;
    this.projectDir = workspace.workspaceRoot;
    this.projectGraphPath = join(workspace.workspaceRoot, "project-graph.json");
    this.packageDir = workspace.packageDir;
    this.statePath = workspace.stateFile;
    this.resultsDir = workspace.resultsDir;
  }
}
