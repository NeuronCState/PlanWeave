import type { Command } from "commander";
import { unblockTask } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerUnblockCommand(program: Command): void {
  program
    .command("unblock")
    .argument("<task-id>")
    .description("Clear an explicit blocked state and return the task to planned or ready")
    .action(async (taskId: string) => {
      const result = await unblockTask({ projectRoot: resolveCliProjectRoot(), taskId });
      console.log(`Unblocked ${result.taskId}; task is ${result.status}.`);
    });
}
