import type { Command } from "commander";
import { resolve } from "node:path";
import { createCanvasWorkspace, type CreateCanvasWorkspaceResult } from "@planweave-ai/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

type CanvasCreateOptions = {
  id?: string;
  title: string;
  activate?: boolean;
  dryRun?: boolean;
  json?: boolean;
};

type CanvasCreateOutput = Omit<CreateCanvasWorkspaceResult, "canvasValidationArgs" | "projectValidationArgs" | "qualityArgs"> & {
  canvasValidationCommand: string;
  projectValidationCommand: string;
  qualityCommand: string;
};

function shellQuoteArg(value: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(value) ? value : `'${value.replace(/'/g, "'\\''")}'`;
}

function planweaveCommand(args: string[]): string {
  return ["planweave", ...args].map(shellQuoteArg).join(" ");
}

function toCanvasCreateOutput(result: CreateCanvasWorkspaceResult, projectRoot: string): CanvasCreateOutput {
  const rootArgs = ["--project-root", projectRoot];
  return {
    canvasId: result.canvasId,
    title: result.title,
    created: result.created,
    activated: result.activated,
    projectGraphPath: result.projectGraphPath,
    canvasRoot: result.canvasRoot,
    packageDir: result.packageDir,
    manifestPath: result.manifestPath,
    taskPromptsDir: result.taskPromptsDir,
    blockPromptsDir: result.blockPromptsDir,
    statePath: result.statePath,
    resultsDir: result.resultsDir,
    canvasValidationCommand: planweaveCommand([...rootArgs, ...result.canvasValidationArgs]),
    projectValidationCommand: planweaveCommand([...rootArgs, ...result.projectValidationArgs]),
    qualityCommand: planweaveCommand([...rootArgs, ...result.qualityArgs])
  };
}

function formatCanvasCreateHuman(result: CanvasCreateOutput): string {
  return [
    `Canvas: ${result.canvasId}`,
    `Created: ${result.created ? "yes" : "no"}`,
    `Activated: ${result.activated ? "yes" : "no"}`,
    `Package: ${result.packageDir}`,
    `Manifest: ${result.manifestPath}`,
    `Validate canvas: ${result.canvasValidationCommand}`,
    `Validate project: ${result.projectValidationCommand}`,
    `Quality: ${result.qualityCommand}`
  ].join("\n");
}

export function registerCanvasCommand(program: Command): void {
  const canvas = program.command("canvas").description("Manage PlanWeave canvases");

  canvas
    .command("create")
    .description("Create a new PlanWeave canvas workspace")
    .option("--id <canvasId>", "requested canvas id")
    .requiredOption("--title <title>", "canvas title")
    .option("--activate", "make the new canvas active")
    .option("--dry-run", "print the workspace that would be created without writing files")
    .option("--json", "print machine-readable output")
    .action(async (options: CanvasCreateOptions) => {
      const projectRoot = resolve(await resolveCliProjectRoot());
      const result = await createCanvasWorkspace({
        cwd: projectRoot,
        id: options.id,
        title: options.title,
        activate: options.activate,
        dryRun: options.dryRun
      });
      const output = toCanvasCreateOutput(result, projectRoot);
      console.log(options.json ? JSON.stringify(output, null, 2) : formatCanvasCreateHuman(output));
    });
}
