import type { Command } from "commander";
import { getCurrentWork } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerCurrentCommand(program: Command): void {
  program
    .command("current")
    .description("Print the current block or feedback work item for an agent loop")
    .action(async () => {
      const result = await getCurrentWork({ projectRoot: resolveCliProjectRoot() });
      console.log(JSON.stringify(result, null, 2));
    });
}
