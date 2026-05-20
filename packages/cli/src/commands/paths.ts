import type { Command } from "commander";
import { readProjectPaths } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerPathsCommand(program: Command): void {
  program
    .command("paths")
    .description("Print PlanWeave workspace paths for the current project")
    .option("--json", "print machine-readable output")
    .action(async (options: { json?: boolean }) => {
      const paths = await readProjectPaths(resolveCliProjectRoot());
      if (options.json) {
        console.log(JSON.stringify(paths, null, 2));
        return;
      }
      console.log(`Workspace directory: ${paths.workspaceDir}`);
      console.log(`Project: ${paths.projectId}`);
      console.log(`Project directory: ${paths.projectDir}`);
      console.log(`Package: ${paths.packageDir}`);
      console.log(`State: ${paths.statePath}`);
      console.log(`Results: ${paths.resultsDir}`);
    });
}
