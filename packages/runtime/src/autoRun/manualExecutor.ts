import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolvePackageWorkspace } from "../package/loadPackage.js";
import { canvasCommandFlagForWorkspace } from "../taskManager/canvasCommandScope.js";
import type { ExecutorAdapterResult } from "../types.js";
import { nextRunId, prepareBlockRun } from "./executorShared.js";
import { adapterProfileMismatch, type ExecutorBlockInput, type ExecutorFeedbackInput, type ExecutorIntegration } from "./executorIntegration.js";

async function runManualBlock(input: ExecutorBlockInput): Promise<ExecutorAdapterResult> {
  if (input.profile.adapter !== "manual") {
    throw adapterProfileMismatch("manual", input.profile);
  }
  const run = await prepareBlockRun({
    projectRoot: input.projectRoot,
    claim: input.claim,
    executorName: input.executorName,
    profile: input.profile,
    prompt: input.prompt
  });
  const workspace = await resolvePackageWorkspace(input.projectRoot);
  const canvasFlag = await canvasCommandFlagForWorkspace(workspace);
  return {
    kind: "manual",
    executor: input.executorName,
    adapter: "manual",
    promptPath: run.promptPath,
    runDir: run.runDir,
    runId: run.runId,
    nextCommand:
      input.claim.blockType === "review"
        ? `planweave submit-review${canvasFlag} ${input.claim.ref} --result <review-result.json>`
        : `planweave submit-result${canvasFlag} ${input.claim.ref} --report <report.md>`
  };
}

async function runManualFeedback(input: ExecutorFeedbackInput): Promise<ExecutorAdapterResult> {
  if (input.profile.adapter !== "manual") {
    throw adapterProfileMismatch("manual", input.profile);
  }
  const canvasFlag = await canvasCommandFlagForWorkspace(input.workspace);
  const feedbackRoot = join(input.workspace.resultsDir, "feedback-runs");
  const runId = await nextRunId(feedbackRoot);
  const runDir = join(feedbackRoot, runId);
  await mkdir(runDir, { recursive: true });
  const promptPath = join(runDir, "feedback.md");
  await writeFile(promptPath, input.claim.content, "utf8");
  return {
    kind: "manual",
    executor: input.executorName,
    adapter: "manual",
    promptPath,
    runDir,
    runId,
    nextCommand: `planweave submit-feedback${canvasFlag} --report <report.md>`
  };
}

export const manualIntegration: ExecutorIntegration = {
  adapter: "manual",
  builtinProfiles: {
    default: { adapter: "manual" },
    manual: { adapter: "manual" }
  },
  runBlock: runManualBlock,
  runFeedback: runManualFeedback
};
