import type { Command } from "commander";
import { refreshPrompt } from "@planweave-ai/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerRefreshPromptCommand(program: Command): void {
  program
    .command("refresh-prompt")
    .argument("<block-ref>")
    .description("Render one block Prompt Surface without writing source prompts")
    .action(async (ref: string) => {
      const result = await refreshPrompt({ projectRoot: resolveCliProjectRoot(), ref });
      console.log(JSON.stringify({ ref: result.ref, rendered: true }, null, 2));
    });
}
