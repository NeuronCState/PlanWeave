import type { Command } from "commander";
import { resolveDivergence } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerResolveDivergenceCommand(program: Command): void {
  program
    .command("resolve-divergence")
    .argument("<task-id>")
    .requiredOption("--reason <reason>", "why the divergence is resolved")
    .description("Clear a diverged state after the Plan Package has been reconciled")
    .action(async (taskId: string, options: { reason: string }) => {
      const result = await resolveDivergence({ projectRoot: resolveCliProjectRoot(), taskId, reason: options.reason });
      console.log(`Resolved divergence for ${result.taskId}; task is ${result.status}: ${result.reason}`);
    });
}
