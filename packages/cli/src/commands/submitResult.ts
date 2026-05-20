import { Option, type Command } from "commander";
import { runSubmitStatuses, submitRunResult, type RunSubmitStatus } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerSubmitResultCommand(program: Command): void {
  program
    .command("submit-result")
    .argument("<task-id>")
    .requiredOption("--report <path>", "implementation report markdown path")
    .addOption(
      new Option("--status <status>", "implemented, blocked, or diverged")
        .choices([...runSubmitStatuses])
        .default("implemented")
    )
    .option("--reason <reason>", "required when status is blocked or diverged")
    .description("Record a task implementation run")
    .action(async (taskId: string, options: { report: string; status: RunSubmitStatus; reason?: string }) => {
      const result = await submitRunResult({
        projectRoot: resolveCliProjectRoot(),
        taskId,
        reportPath: options.report,
        status: options.status,
        reason: options.reason
      });
      console.log(`Submitted ${result.taskId} ${result.runId} as ${result.status}.`);
    });
}
