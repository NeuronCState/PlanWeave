import type { Command } from "commander";
import { explainBlock } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerExplainCommand(program: Command): void {
  program
    .command("explain <ref>")
    .description("Explain why a block is or is not claimable")
    .action(async (ref: string) => {
      const result = await explainBlock({ projectRoot: resolveCliProjectRoot(), ref });
      console.log(JSON.stringify(result, null, 2));
    });
}

export function registerWhyNotCommand(program: Command): void {
  program
    .command("why-not <ref>")
    .description("Alias for explain: show why a block is not claimable")
    .action(async (ref: string) => {
      const result = await explainBlock({ projectRoot: resolveCliProjectRoot(), ref });
      console.log(JSON.stringify(result, null, 2));
    });
}
