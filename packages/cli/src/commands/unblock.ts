import type { Command } from "commander";
import { unblockBlock } from "@planweave-ai/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerUnblockCommand(program: Command): void {
  program
    .command("unblock")
    .argument("<block-ref>")
    .requiredOption("--reason <reason>", "reason for clearing the blocked state")
    .description("Clear an explicit block blocked state")
    .action(async (ref: string, options: { reason: string }) => {
      const result = await unblockBlock({ projectRoot: resolveCliProjectRoot(), ref, reason: options.reason });
      console.log(JSON.stringify(result, null, 2));
    });
}
