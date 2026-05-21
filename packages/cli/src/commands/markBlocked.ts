import type { Command } from "commander";
import { markBlockBlocked } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerMarkBlockedCommand(program: Command): void {
  program
    .command("mark-blocked")
    .argument("<block-ref>")
    .requiredOption("--reason <reason>", "why the block is blocked")
    .description("Mark a block as blocked")
    .action(async (ref: string, options: { reason: string }) => {
      const result = await markBlockBlocked({ projectRoot: resolveCliProjectRoot(), ref, reason: options.reason });
      console.log(JSON.stringify(result, null, 2));
    });
}
