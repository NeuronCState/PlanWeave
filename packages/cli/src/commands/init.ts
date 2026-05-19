import type { Command } from "commander";
import { initWorkspace } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create the local PlanWeave workspace for the current project")
    .option("--force", "rewrite the minimal workspace skeleton")
    .action(async (options: { force?: boolean }) => {
      const result = await initWorkspace({ projectRoot: resolveCliProjectRoot(), force: options.force });
      console.log(`Workspace: ${result.workspace.workspaceRoot}`);
      console.log(`Project: ${result.project.id}`);
    });
}
