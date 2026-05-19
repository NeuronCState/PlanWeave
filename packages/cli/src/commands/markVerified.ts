import type { Command } from "commander";
import { markVerified } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerMarkVerifiedCommand(program: Command): void {
  program
    .command("mark-verified")
    .argument("<task-id>")
    .description("Mark a task verified without creating a review run")
    .action(async (taskId: string) => {
      const result = await markVerified({ projectRoot: resolveCliProjectRoot(), taskId });
      console.log(`Marked ${result.taskId} as ${result.status}.`);
    });
}
