import type { Command } from "commander";
import { markBlocked } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerMarkBlockedCommand(program: Command): void {
  program
    .command("mark-blocked")
    .argument("<task-id>")
    .requiredOption("--reason <reason>", "why the task is blocked")
    .description("Mark a non-verified task as blocked")
    .action(async (taskId: string, options: { reason: string }) => {
      const result = await markBlocked({ projectRoot: resolveCliProjectRoot(), taskId, reason: options.reason });
      console.log(`Marked ${result.taskId} as ${result.status}: ${result.reason}`);
    });
}
