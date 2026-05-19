import type { Command } from "commander";
import { claimNextParallel, claimNextTask } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerClaimNextCommand(program: Command): void {
  program
    .command("claim-next")
    .description("Claim the next executable task")
    .option("--force", "claim a new task even if another task is already in progress")
    .option("--parallel", "claim a deterministic parallel batch")
    .action(async (options: { force?: boolean; parallel?: boolean }) => {
      if (options.parallel) {
        const result = await claimNextParallel({ projectRoot: resolveCliProjectRoot(), force: options.force });
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      const result = await claimNextTask({ projectRoot: resolveCliProjectRoot(), force: options.force });
      console.log(JSON.stringify(result, null, 2));
    });
}
