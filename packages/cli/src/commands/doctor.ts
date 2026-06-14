import type { Command } from "commander";
import { runDoctor } from "@planweave-ai/runtime";
import { addCanvasOption, resolveCliPackageWorkspace, type CanvasCommandOptions } from "../cliWorkspace.js";

export function registerDoctorCommand(program: Command): void {
  addCanvasOption(program
    .command("doctor")
    .description("Check PlanWeave state/results consistency for agent recovery")
    .option("--repair", "repair recoverable state/results drift"))
    .action(async (options: { repair?: boolean } & CanvasCommandOptions) => {
      const result = await runDoctor({ projectRoot: await resolveCliPackageWorkspace(options), repair: options.repair === true });
      console.log(JSON.stringify(result, null, 2));
    });
}
