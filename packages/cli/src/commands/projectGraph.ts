import type { Command } from "commander";
import { materializeProjectGraph } from "@planweave-ai/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerProjectGraphCommand(program: Command): void {
  const command = program.command("project-graph").description("Manage the formal project-graph.json canvas graph");

  command
    .command("migrate")
    .description("Write project-graph.json from the current legacy/default canvas graph when it is missing")
    .option("--json", "print machine-readable output")
    .action(async (options: { json?: boolean }) => {
      const result = await materializeProjectGraph(resolveCliProjectRoot());
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(result.created ? `Project graph: ${result.path}` : `Project graph already exists: ${result.path}`);
      console.log(`Source: ${result.source}`);
      console.log(`Canvases: ${result.canvasCount}`);
    });
}
