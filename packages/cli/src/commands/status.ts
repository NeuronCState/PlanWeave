import type { Command } from "commander";
import { getStatus, type PlanStatus } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

function describeNoClaimReason(reason: PlanStatus["noClaimReason"]): string {
  switch (reason) {
    case "all_done":
      return "all tasks are implemented or verified";
    case "dependency_blocked":
      return "remaining tasks are waiting on dependencies";
    case "blocked":
      return "remaining tasks are blocked";
    case "diverged":
      return "remaining tasks are diverged and need recovery";
    case "no_tasks":
      return "the package has no tasks";
    case "has_claimable":
      return "tasks are claimable";
  }
}

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show the current PlanWeave task status summary")
    .option("--json", "print machine-readable output")
    .action(async (options: { json?: boolean }) => {
      const status = await getStatus({ projectRoot: resolveCliProjectRoot() });
      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }
      console.log(`Project: ${status.projectId}`);
      console.log(`Root: ${status.projectRoot}`);
      console.log(`Tasks: ${status.taskTotal}`);
      console.log(`Current: ${status.currentTaskId ?? "none"}`);
      console.log(`Next claimable: ${status.nextClaimable.join(", ") || "none"}`);
      if (status.nextClaimable.length === 0) {
        console.log(`No claimable reason: ${describeNoClaimReason(status.noClaimReason)}`);
      }
      console.log(`needs_changes: ${status.needsChanges}`);
      console.log(`diverged: ${status.diverged}`);
      if (status.blockedTasks.length > 0) {
        console.log("Blocked tasks:");
        for (const task of status.blockedTasks) {
          console.log(`- ${task.taskId}: ${task.reason ?? "no reason recorded"}`);
        }
      }
      if (status.divergedTasks.length > 0) {
        console.log("Diverged tasks:");
        for (const task of status.divergedTasks) {
          console.log(`- ${task.taskId}: ${task.reason ?? "no reason recorded"}`);
        }
      }
      if (status.orphanResults.length > 0) {
        console.log("Orphan results:");
        for (const item of status.orphanResults) {
          console.log(`- ${item.taskId}: ${item.path}`);
        }
      }
      if (status.orphanState.length > 0) {
        console.log("Orphan state:");
        for (const item of status.orphanState) {
          console.log(`- ${item.taskId}: ${item.status}`);
        }
      }
      console.log("Counts:");
      for (const [key, value] of Object.entries(status.counts)) {
        console.log(`- ${key}: ${value}`);
      }
    });
}
