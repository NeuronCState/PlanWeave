import type { Command } from "commander";
import { markDiverged } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerMarkDivergedCommand(program: Command): void {
  program
    .command("mark-diverged")
    .argument("<task-id>")
    .requiredOption("--reason <reason>", "why the plan no longer matches implementation reality")
    .description("Mark a non-verified task as diverged")
    .action(async (taskId: string, options: { reason: string }) => {
      const result = await markDiverged({ projectRoot: resolveCliProjectRoot(), taskId, reason: options.reason });
      console.log(`Marked ${result.taskId} as ${result.status}: ${result.reason}`);
    });
}
