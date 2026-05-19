import { readFile } from "node:fs/promises";
import { Command, Option } from "commander";
import {
  addEdge,
  addNode,
  edgeTypes,
  manifestNodeSchema,
  removeEdge,
  removeNode,
  updateNode,
  updatePromptSurface
} from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";
import type { EdgeType, GraphEditResult, ManifestEdge, ManifestNode } from "@planweave/runtime";

function printGraphEditResult(result: GraphEditResult): void {
  const { graph: _graph, ...serializable } = result;
  console.log(JSON.stringify(serializable, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

function parseJsonNode(json: string): ManifestNode {
  const parsed = manifestNodeSchema.safeParse(JSON.parse(json));
  if (!parsed.success) {
    const details = parsed.error.issues.map((item) => `${item.path.join(".") || "node"}: ${item.message}`).join("; ");
    throw new Error(`Invalid node JSON: ${details}`);
  }
  return parsed.data;
}

async function readPromptMarkdown(options: { prompt?: string; promptFile?: string }): Promise<string | undefined> {
  if (options.prompt !== undefined && options.promptFile !== undefined) {
    throw new Error("Use either --prompt or --prompt-file, not both.");
  }
  if (options.prompt !== undefined) {
    return options.prompt;
  }
  if (options.promptFile !== undefined) {
    return readFile(options.promptFile, "utf8");
  }
  return undefined;
}

function edgeFromOptions(from: string, to: string, type: EdgeType): ManifestEdge {
  return { from, to, type };
}

export function registerEditGraphCommands(program: Command): void {
  program
    .command("add-node")
    .description("Add a node to manifest.json")
    .requiredOption("--json <node>", "Manifest node JSON")
    .option("--prompt <markdown>", "Prompt Surface markdown for a task node")
    .option("--prompt-file <path>", "Prompt Surface file to copy for a task node")
    .action(async (options: { json: string; prompt?: string; promptFile?: string }) => {
      const result = await addNode({
        projectRoot: resolveCliProjectRoot(),
        node: parseJsonNode(options.json),
        promptMarkdown: await readPromptMarkdown(options)
      });
      printGraphEditResult(result);
    });

  program
    .command("update-node")
    .description("Replace a node in manifest.json")
    .requiredOption("--json <node>", "Manifest node JSON")
    .action(async (options: { json: string }) => {
      const result = await updateNode({ projectRoot: resolveCliProjectRoot(), node: parseJsonNode(options.json) });
      printGraphEditResult(result);
    });

  program
    .command("remove-node")
    .description("Remove a node and its related edges from manifest.json")
    .argument("<node-id>")
    .option("--remove-prompt", "Also remove the task Prompt Surface file")
    .action(async (nodeId: string, options: { removePrompt?: boolean }) => {
      const result = await removeNode({ projectRoot: resolveCliProjectRoot(), nodeId, removePrompt: options.removePrompt });
      printGraphEditResult(result);
    });

  program
    .command("add-edge")
    .description("Add an edge to manifest.json")
    .requiredOption("--from <node-id>", "Source node id")
    .requiredOption("--to <node-id>", "Target node id")
    .addOption(new Option("--type <edge-type>", "Edge type").choices([...edgeTypes]).makeOptionMandatory())
    .action(async (options: { from: string; to: string; type: EdgeType }) => {
      const result = await addEdge({ projectRoot: resolveCliProjectRoot(), edge: edgeFromOptions(options.from, options.to, options.type) });
      printGraphEditResult(result);
    });

  program
    .command("remove-edge")
    .description("Remove an edge from manifest.json")
    .requiredOption("--from <node-id>", "Source node id")
    .requiredOption("--to <node-id>", "Target node id")
    .addOption(new Option("--type <edge-type>", "Edge type").choices([...edgeTypes]).makeOptionMandatory())
    .action(async (options: { from: string; to: string; type: EdgeType }) => {
      const result = await removeEdge({ projectRoot: resolveCliProjectRoot(), edge: edgeFromOptions(options.from, options.to, options.type) });
      printGraphEditResult(result);
    });

  program
    .command("update-task-body")
    .description("Replace the user task-body section of a task Prompt Surface")
    .argument("<task-id>")
    .option("--body <markdown>", "New task-body markdown")
    .option("--body-file <path>", "File containing new task-body markdown")
    .action(async (taskId: string, options: { body?: string; bodyFile?: string }) => {
      if (options.body !== undefined && options.bodyFile !== undefined) {
        throw new Error("Use either --body or --body-file, not both.");
      }
      const taskBody = options.body ?? (options.bodyFile ? await readFile(options.bodyFile, "utf8") : undefined);
      if (taskBody === undefined) {
        throw new Error("Either --body or --body-file is required.");
      }
      const result = await updatePromptSurface({ projectRoot: resolveCliProjectRoot(), taskId, taskBody });
      printGraphEditResult(result);
    });
}
