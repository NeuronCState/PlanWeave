import type { Command } from "commander";
import { getPrompt } from "@planweave-ai/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerPromptCommand(program: Command): void {
  program
    .command("prompt")
    .argument("<block-ref>")
    .description("Render and print a block Prompt Surface")
    .action(async (ref: string) => {
      process.stdout.write(await getPrompt({ projectRoot: resolveCliProjectRoot(), ref }));
    });
}
