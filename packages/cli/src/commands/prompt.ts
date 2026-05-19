import type { Command } from "commander";
import { getPrompt } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerPromptCommand(program: Command): void {
  program
    .command("prompt")
    .argument("<task-id>")
    .description("Refresh and print a task Prompt Surface")
    .action(async (taskId: string) => {
      process.stdout.write(await getPrompt({ projectRoot: resolveCliProjectRoot(), taskId }));
    });
}
