import type { Command } from "commander";
import { claimNext } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerClaimNextCommand(program: Command): void {
  program
    .command("claim-next")
    .description("Claim the next executable block or feedback event")
    .option("--parallel", "claim a deterministic parallel batch")
    .option("--dry-run", "preview the next claim without mutating state")
    .action(async (options: { parallel?: boolean; dryRun?: boolean }) => {
      const result = await claimNext({ projectRoot: resolveCliProjectRoot(), parallel: options.parallel, dryRun: options.dryRun });
      console.log(JSON.stringify(result, null, 2));
    });
}
