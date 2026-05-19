import type { Command } from "commander";
import { refreshPrompt } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerRefreshPromptCommand(program: Command): void {
  program
    .command("refresh-prompt")
    .argument("<task-id>")
    .description("Refresh managed sections for one Prompt Surface")
    .action(async (taskId: string) => {
      const result = await refreshPrompt({ projectRoot: resolveCliProjectRoot(), taskId });
      console.log(`Refreshed ${result.taskId}: ${result.path}`);
    });
}
