import type { Command } from "commander";
import { submitReviewResult } from "@planweave/runtime";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerSubmitReviewCommand(program: Command): void {
  program
    .command("submit-review")
    .argument("<review-block-ref>")
    .requiredOption("--result <path>", "review-result.json path")
    .description("Record a structured review result for a review block")
    .action(async (ref: string, options: { result: string }) => {
      const result = await submitReviewResult({
        projectRoot: resolveCliProjectRoot(),
        ref,
        resultPath: options.result
      });
      console.log(JSON.stringify(result, null, 2));
    });
}
