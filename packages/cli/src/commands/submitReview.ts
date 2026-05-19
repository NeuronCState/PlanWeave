import { Option, type Command } from "commander";
import { reviewStatuses, submitReview, type ReviewStatus } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerSubmitReviewCommand(program: Command): void {
  program
    .command("submit-review")
    .argument("<task-id>")
    .requiredOption("--report <path>", "review report markdown path")
    .addOption(new Option("--status <status>", "passed or needs_changes").choices([...reviewStatuses]).makeOptionMandatory())
    .description("Record the current review conclusion for a task")
    .action(async (taskId: string, options: { report: string; status: ReviewStatus }) => {
      const result = await submitReview({
        projectRoot: resolveCliProjectRoot(),
        taskId,
        reportPath: options.report,
        status: options.status
      });
      console.log(`Reviewed ${result.taskId} as ${result.status}; task is ${result.taskStatus}.`);
    });
}
