import type { Command } from "commander";
import { markBlockDiverged } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerMarkDivergedCommand(program: Command): void {
  program
    .command("mark-diverged")
    .argument("<block-ref>")
    .requiredOption("--reason <reason>", "why the plan no longer matches implementation reality")
    .description("Mark a block as diverged")
    .action(async (ref: string, options: { reason: string }) => {
      const result = await markBlockDiverged({ projectRoot: resolveCliProjectRoot(), ref, reason: options.reason });
      console.log(JSON.stringify(result, null, 2));
    });
}
