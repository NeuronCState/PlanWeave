import type { Command } from "commander";
import { refreshPrompts } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerRefreshPromptsCommand(program: Command): void {
  program
    .command("refresh-prompts")
    .description("Refresh managed sections for all task Prompt Surfaces")
    .action(async () => {
      const result = await refreshPrompts({ projectRoot: resolveCliProjectRoot() });
      for (const prompt of result.prompts) {
        console.log(`Refreshed ${prompt.taskId}: ${prompt.path}`);
      }
      if (result.prompts.length === 0) {
        console.log("No task prompts to refresh.");
      }
    });
}
