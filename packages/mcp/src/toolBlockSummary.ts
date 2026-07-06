import type { RuntimeGateway } from "./toolTypes.js";

export function summarizeBlockDetail(block: Awaited<ReturnType<RuntimeGateway["getBlockDetail"]>>) {
  return {
    ref: block.ref,
    taskId: block.taskId,
    blockId: block.blockId,
    type: block.type,
    title: block.title,
    status: block.status,
    executor: block.executor,
    effectiveExecutor: block.effectiveExecutor,
    promptMissing: block.promptMissing,
    promptMarkdownAvailable: !block.promptMissing,
    renderedPromptAvailable: true,
    promptSourceCount: block.promptSources.length,
    dependencies: block.dependencies,
    latestRunId: block.latestRunId,
    latestReviewAttemptId: block.latestReviewAttemptId,
    activeFeedbackId: block.activeFeedbackId,
    exceptionReason: block.exceptionReason,
    reviewGate: block.reviewGate
  };
}
