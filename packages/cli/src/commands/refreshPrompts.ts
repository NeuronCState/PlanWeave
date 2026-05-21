import type { Command } from "commander";
import { refreshPrompts } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerRefreshPromptsCommand(program: Command): void {
  program
    .command("refresh-prompts")
    .description("Render all block Prompt Surfaces without writing source prompts")
    .action(async () => {
      const result = await refreshPrompts({ projectRoot: resolveCliProjectRoot() });
      for (const prompt of result.prompts) {
        console.log(`Rendered ${prompt.ref}`);
      }
      if (result.prompts.length === 0) {
        console.log("No block prompts to render.");
      }
    });
}
