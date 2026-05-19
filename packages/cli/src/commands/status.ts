import type { Command } from "commander";
import { getStatus } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show the current PlanWeave task status summary")
    .action(async () => {
      const status = await getStatus({ projectRoot: resolveCliProjectRoot() });
      console.log(`Project: ${status.projectId}`);
      console.log(`Root: ${status.projectRoot}`);
      console.log(`Tasks: ${status.taskTotal}`);
      console.log(`Current: ${status.currentTaskId ?? "none"}`);
      console.log(`needs_changes: ${status.needsChanges}`);
      console.log(`diverged: ${status.diverged}`);
      console.log("Counts:");
      for (const [key, value] of Object.entries(status.counts)) {
        console.log(`- ${key}: ${value}`);
      }
    });
}
