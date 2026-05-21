import type { Command } from "commander";
import { claimNext } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerClaimNextCommand(program: Command): void {
  program
    .command("claim-next")
    .description("Claim the next executable block or feedback event")
    .option("--parallel", "claim a deterministic parallel batch")
    .action(async (options: { parallel?: boolean }) => {
      const result = await claimNext({ projectRoot: resolveCliProjectRoot(), parallel: options.parallel });
      console.log(JSON.stringify(result, null, 2));
    });
}
