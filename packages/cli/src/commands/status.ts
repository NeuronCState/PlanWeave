import type { Command } from "commander";
import { getExecutionStatus, type ClaimHint } from "@planweave-ai/runtime";
import { addCanvasOption, resolveCliCanvasId, resolveCliPackageWorkspace, type CanvasCommandOptions } from "../cliWorkspace.js";

export function formatClaimHint(hint: ClaimHint): string {
  const blockers = [...hint.blockedByTasks.map((taskId) => `task:${taskId}`), ...hint.blockedByBlocks.map((ref) => `block:${ref}`)];
  const reason = hint.ready
    ? hint.readyReason
    : blockers.length > 0
      ? `blocked by ${blockers.join(", ")}`
      : hint.statusReason
        ? `${hint.status}: ${hint.statusReason}`
        : `status ${hint.status}`;
  const gate = hint.reviewGate ? "review gate, " : "";
  const mode = hint.sequentialOnly ? "sequential-only" : "parallel-safe";
  const command = hint.recommendedCommand ? `, run: ${hint.recommendedCommand}` : hint.dispatchCommand ? `, dispatch: ${hint.dispatchCommand}` : "";
  return `- ${hint.ref}: ${reason}, ${gate}${mode}${command}`;
}

function withCanvasFlag(command: string | null, canvasId: string | null): string | null {
  if (!command || !canvasId) {
    return command;
  }
  const [binary, subcommand, ...rest] = command.split(" ");
  return [binary, subcommand, "--canvas", canvasId, ...rest].join(" ");
}

function withCanvasCommands<T extends { claimHints: ClaimHint[] }>(status: T, canvasId: string | null): T {
  if (!canvasId) {
    return status;
  }
  return {
    ...status,
    claimHints: status.claimHints.map((hint) => ({
      ...hint,
      recommendedCommand: withCanvasFlag(hint.recommendedCommand, canvasId),
      dispatchCommand: withCanvasFlag(hint.dispatchCommand, canvasId)
    }))
  };
}

export function registerStatusCommand(program: Command): void {
  addCanvasOption(program
    .command("status")
    .description("Show the current PlanWeave block execution status")
    .option("--json", "print machine-readable output"))
    .action(async (options: { json?: boolean } & CanvasCommandOptions) => {
      const status = withCanvasCommands(await getExecutionStatus({ projectRoot: await resolveCliPackageWorkspace(options) }), resolveCliCanvasId(options));
      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }
      console.log(`Project: ${status.projectId}`);
      console.log(`Root: ${status.projectRoot}`);
      console.log(`Tasks: ${status.taskTotal}`);
      console.log(`Blocks: ${status.blockTotal}`);
      console.log(`Current refs: ${status.currentRefs.join(", ") || "none"}`);
      console.log(`Current feedback: ${status.currentFeedbackId ?? "none"}`);
      console.log(`Next claimable: ${status.nextClaimable.join(", ") || "none"}`);
      console.log(`Next parallel claimable: ${status.nextParallelClaimable.join(", ") || "none"}`);
      console.log(`Next sequential claimable: ${status.nextSequentialClaimable.join(", ") || "none"}`);
      console.log(`Next parallel dispatchable: ${status.nextParallelDispatchable.join(", ") || "none"}`);
      console.log("Claim hints:");
      for (const hint of status.claimHints) {
        console.log(formatClaimHint(hint));
      }
      console.log("Task counts:");
      for (const [key, value] of Object.entries(status.counts.tasks)) {
        console.log(`- ${key}: ${value}`);
      }
      console.log("Block counts:");
      for (const [key, value] of Object.entries(status.counts.blocks)) {
        console.log(`- ${key}: ${value}`);
      }
      if (status.warnings.length > 0) {
        console.log("Warnings:");
        for (const warning of status.warnings) {
          console.log(`- ${warning.code}: ${warning.message}`);
        }
      }
    });
}
