import type { Command } from "commander";
import { resolveBlockDivergence } from "@planweave-ai/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerResolveDivergenceCommand(program: Command): void {
  program
    .command("resolve-divergence")
    .argument("<block-ref>")
    .requiredOption("--reason <reason>", "why the divergence is resolved")
    .description("Clear a diverged block after the Plan Package has been reconciled")
    .action(async (ref: string, options: { reason: string }) => {
      const result = await resolveBlockDivergence({ projectRoot: resolveCliProjectRoot(), ref, reason: options.reason });
      console.log(JSON.stringify(result, null, 2));
    });
}
