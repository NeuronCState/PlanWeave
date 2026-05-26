import { spawn } from "node:child_process";
import { z } from "zod";
import type { ManifestReviewBlock, ManifestTaskNode, ReviewHookOutput, ReviewResult } from "../types.js";

const reviewHookOutputSchema = z
  .object({
    action: z.literal("use_feedback"),
    feedbackPrompt: z.string().min(1)
  })
  .strict();

export async function executeReviewHook(options: {
  projectRoot: string;
  reviewBlock: ManifestReviewBlock;
  reviewResult: ReviewResult;
  task: ManifestTaskNode;
  reviewBlockRef: string;
  feedbackCycleCount: number;
}): Promise<ReviewHookOutput> {
  const hook = options.reviewBlock.review.hook;
  if (!hook) {
    return { action: "use_feedback", feedbackPrompt: options.reviewResult.content };
  }
  const input = JSON.stringify({
    reviewResult: options.reviewResult,
    task: { taskId: options.task.id, title: options.task.title },
    reviewBlockRef: options.reviewBlockRef,
    feedbackCycleCount: options.feedbackCycleCount
  });
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(hook.command, hook.args, { cwd: options.projectRoot, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr.trim() || `hook exited with code ${code}`));
      }
    });
    child.stdin.end(input);
  });
  const parsed = reviewHookOutputSchema.safeParse(JSON.parse(output));
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}
