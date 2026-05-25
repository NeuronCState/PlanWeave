import { describe, expect, it } from "vitest";
import { claimNext, getExecutionStatus, renderPrompt, submitBlockResult, submitReviewResult, submitFeedback } from "../taskManager/index.js";
import { basicManifest, createTestWorkspace, writeReport, writeReviewResult } from "./promptTestHelpers.js";

describe("claimNext", () => {
  it("returns JSON block claims in execution order", async () => {
    const { root } = await createTestWorkspace();

    const first = await claimNext({ projectRoot: root });

    expect(first).toEqual({
      kind: "block",
      ref: "T-001#B-001",
      taskId: "T-001",
      blockId: "B-001",
      blockType: "implementation",
      reason: "claimed"
    });
  });

  it("continues the same review block after feedback is resolved", async () => {
    const { root } = await createTestWorkspace();
    await claimNext({ projectRoot: root });
    await submitBlockResult({ projectRoot: root, ref: "T-001#B-001", reportPath: await writeReport(root, "b.md") });
    await claimNext({ projectRoot: root });
    await submitBlockResult({ projectRoot: root, ref: "T-001#C-001", reportPath: await writeReport(root, "c.md") });
    await claimNext({ projectRoot: root });
    await submitReviewResult({
      projectRoot: root,
      ref: "T-001#R-001",
      resultPath: await writeReviewResult(root, "needs_changes", "Please update tests.")
    });

    expect(await claimNext({ projectRoot: root })).toEqual({ kind: "feedback", content: "Please update tests." });
    await submitFeedback({ projectRoot: root, reportPath: await writeReport(root, "feedback.md", "Tests updated.\n") });

    const reviewClaim = await claimNext({ projectRoot: root });
    const prompt = await renderPrompt({ projectRoot: root, ref: "T-001#R-001" });

    expect(reviewClaim).toMatchObject({ kind: "block", ref: "T-001#R-001", reason: "feedback_resolved" });
    expect(prompt).toContain("Focused Re-review Context");
    expect(prompt).toContain("Please update tests.");
    expect(prompt).toContain("Tests updated.");
  });

  it("reports blocked claims before returning none", async () => {
    const { root } = await createTestWorkspace();
    await claimNext({ projectRoot: root });
    await submitBlockResult({ projectRoot: root, ref: "T-001#B-001", reportPath: await writeReport(root, "b.md") });
    await claimNext({ projectRoot: root });
    await submitBlockResult({ projectRoot: root, ref: "T-001#C-001", reportPath: await writeReport(root, "c.md") });
    await claimNext({ projectRoot: root });

    const status = await getExecutionStatus({ projectRoot: root });
    expect(status.blocks.find((block) => block.ref === "T-001#R-001")?.status).toBe("in_progress");
  });

  it("does not auto-claim optional review blocks", async () => {
    const manifest = basicManifest();
    const task = manifest.nodes.find((node) => node.type === "task" && node.id === "T-001");
    const reviewBlock = task?.blocks.find((block) => block.type === "review");
    expect(reviewBlock?.type).toBe("review");
    if (reviewBlock?.type === "review") {
      reviewBlock.review.required = false;
    }

    const { root } = await createTestWorkspace(manifest);
    await claimNext({ projectRoot: root });
    await submitBlockResult({ projectRoot: root, ref: "T-001#B-001", reportPath: await writeReport(root, "b.md") });
    await claimNext({ projectRoot: root });
    await submitBlockResult({ projectRoot: root, ref: "T-001#C-001", reportPath: await writeReport(root, "c.md") });

    expect(await claimNext({ projectRoot: root })).toEqual({ kind: "none", reason: "no_claimable_blocks" });

    const status = await getExecutionStatus({ projectRoot: root });
    expect(status.tasks.find((taskStatus) => taskStatus.taskId === "T-001")?.status).toBe("implemented");
    expect(status.blocks.find((block) => block.ref === "T-001#R-001")?.status).toBe("ready");
    expect(status.nextClaimable).not.toContain("T-001#R-001");
  });

  it("implements a task after required non-review blocks complete when no review block exists", async () => {
    const manifest = basicManifest();
    const task = manifest.nodes.find((node) => node.type === "task" && node.id === "T-001");
    if (task?.type !== "task") {
      throw new Error("missing task");
    }
    task.blocks = task.blocks.filter((block) => block.type !== "review");

    const { root } = await createTestWorkspace(manifest);
    await claimNext({ projectRoot: root });
    await submitBlockResult({ projectRoot: root, ref: "T-001#B-001", reportPath: await writeReport(root, "b.md") });
    await claimNext({ projectRoot: root });
    await submitBlockResult({ projectRoot: root, ref: "T-001#C-001", reportPath: await writeReport(root, "c.md") });

    expect(await claimNext({ projectRoot: root })).toEqual({ kind: "none", reason: "no_claimable_blocks" });

    const status = await getExecutionStatus({ projectRoot: root });
    expect(status.tasks.find((taskStatus) => taskStatus.taskId === "T-001")?.status).toBe("implemented");
    expect(status.blocks.map((block) => block.ref)).toEqual(["T-001#B-001", "T-001#C-001"]);
    expect(status.nextClaimable).toEqual([]);
  });
});
