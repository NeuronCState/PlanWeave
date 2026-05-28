import type { Command } from "commander";
import { submitFeedback } from "@planweave-ai/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerSubmitFeedbackCommand(program: Command): void {
  program
    .command("submit-feedback")
    .requiredOption("--report <path>", "feedback handling report markdown path")
    .description("Submit the active feedback handling report")
    .action(async (options: { report: string }) => {
      const result = await submitFeedback({ projectRoot: resolveCliProjectRoot(), reportPath: options.report });
      console.log(JSON.stringify(result, null, 2));
    });
}
