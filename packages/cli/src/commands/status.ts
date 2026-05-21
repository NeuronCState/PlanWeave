import type { Command } from "commander";
import { getExecutionStatus } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show the current PlanWeave block execution status")
    .option("--json", "print machine-readable output")
    .action(async (options: { json?: boolean }) => {
      const status = await getExecutionStatus({ projectRoot: resolveCliProjectRoot() });
      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }
      console.log(`Project: ${status.projectId}`);
      console.log(`Root: ${status.projectRoot}`);
      console.log(`Tasks: ${status.taskTotal}`);
      console.log(`Blocks: ${status.blockTotal}`);
      console.log(`Current refs: ${status.currentRefs.join(", ") || "none"}`);
      console.log(`Current feedback: ${status.currentFeedbackId ?? "none"}`);
      console.log(`Next claimable: ${status.nextClaimable.join(", ") || "none"}`);
      console.log("Task counts:");
      for (const [key, value] of Object.entries(status.counts.tasks)) {
        console.log(`- ${key}: ${value}`);
      }
      console.log("Block counts:");
      for (const [key, value] of Object.entries(status.counts.blocks)) {
        console.log(`- ${key}: ${value}`);
      }
      if (status.warnings.length > 0) {
        console.log("Warnings:");
        for (const warning of status.warnings) {
          console.log(`- ${warning.code}: ${warning.message}`);
        }
      }
    });
}
