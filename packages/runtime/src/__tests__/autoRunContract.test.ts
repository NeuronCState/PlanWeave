import { describe, expect, it } from "vitest";
import { consumeAutoRunClaim } from "../autoRun/contract.js";
import type { AutoRunExecutorAdapter } from "../autoRun/contract.js";

function adapter(): AutoRunExecutorAdapter {
  return {
    executeBlock: async (claim) => ({
      kind: claim.blockType === "review" ? "review_result" : "block_report",
      ref: claim.ref,
      artifactPath: `${claim.ref}.md`
    }),
    handleFeedback: async (claim) => ({
      kind: "feedback_report",
      artifactPath: `${claim.content}.md`
    })
  };
}

describe("Auto Run contract", () => {
  it("routes Claim Result branches to an executor adapter without duplicating Task Manager state decisions", async () => {
    await expect(
      consumeAutoRunClaim(
        { kind: "block", ref: "T-001#B-001", taskId: "T-001", blockId: "B-001", blockType: "implementation" },
        adapter()
      )
    ).resolves.toEqual({
      kind: "submit_result",
      ref: "T-001#B-001",
      reportPath: "T-001#B-001.md"
    });
    await expect(
      consumeAutoRunClaim({ kind: "feedback", content: "fix" }, adapter())
    ).resolves.toEqual({
      kind: "submit_feedback",
      reportPath: "fix.md"
    });
    await expect(consumeAutoRunClaim({ kind: "none", reason: "done" }, adapter())).resolves.toEqual({
      kind: "stop",
      reason: "done"
    });
    await expect(consumeAutoRunClaim({ kind: "blocked", ref: "T-001#R-001", reason: "hook failed" }, adapter())).resolves.toEqual({
      kind: "blocked",
      ref: "T-001#R-001",
      reason: "hook failed"
    });
  });
});
