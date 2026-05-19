#!/usr/bin/env node
import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerValidateCommand } from "./commands/validate.js";
import { registerRefreshPromptCommand } from "./commands/refreshPrompt.js";
import { registerRefreshPromptsCommand } from "./commands/refreshPrompts.js";
import { registerPromptCommand } from "./commands/prompt.js";
import { registerClaimNextCommand } from "./commands/claimNext.js";
import { registerSubmitResultCommand } from "./commands/submitResult.js";
import { registerSubmitReviewCommand } from "./commands/submitReview.js";
import { registerMarkVerifiedCommand } from "./commands/markVerified.js";
import { registerMarkDivergedCommand } from "./commands/markDiverged.js";
import { registerStatusCommand } from "./commands/status.js";

export function createProgram(): Command {
  const program = new Command();
  program
    .name("planweave")
    .description("PlanWeave CLI")
    .version("0.0.0");

  registerInitCommand(program);
  registerValidateCommand(program);
  registerRefreshPromptCommand(program);
  registerRefreshPromptsCommand(program);
  registerClaimNextCommand(program);
  registerPromptCommand(program);
  registerSubmitResultCommand(program);
  registerSubmitReviewCommand(program);
  registerMarkVerifiedCommand(program);
  registerMarkDivergedCommand(program);
  registerStatusCommand(program);

  return program;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await createProgram().parseAsync(process.argv);
}
