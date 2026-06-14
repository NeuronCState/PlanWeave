import { describe, expect, it } from "vitest";
import { buildClaimReadiness } from "../taskManager/claimReadiness.js";
import { loadRuntime } from "../taskManager/runtimeContext.js";
import { basicManifest, createTestWorkspace } from "./promptTestHelpers.js";

describe("claim readiness", () => {
  it("derives claim hints and next claimable refs without mutating runtime state", async () => {
    const { root } = await createTestWorkspace();
    const context = await loadRuntime({ projectRoot: root });

    const readiness = buildClaimReadiness(context);

    expect(readiness.nextClaimable).toEqual(["T-001#B-001"]);
    expect(readiness.nextParallelClaimable).toEqual(["T-001#B-001"]);
    expect(readiness.nextSequentialClaimable).toEqual([]);
    expect(readiness.claimHints.find((hint) => hint.ref === "T-001#B-001")).toMatchObject({
      ready: true,
      readyReason: "Block is ready and parallel-safe.",
      recommendedCommand: "planweave claim T-001#B-001"
    });
    expect(context.state.currentRefs).toEqual([]);
  });

  it("accepts a project graph claim guard adapter for blocker explanations", async () => {
    const { root } = await createTestWorkspace();
    const context = await loadRuntime({ projectRoot: root });

    const readiness = buildClaimReadiness({
      ...context,
      projectGuard: {
        blockerReasonForTask: (taskId) => (taskId === "T-001" ? "Project graph blockers are not complete: canvas:upstream." : null)
      }
    });

    expect(readiness.nextClaimable).toEqual([]);
    expect(readiness.firstProjectBlockedResult).toEqual({
      kind: "blocked",
      ref: "T-001#B-001",
      reason: "Project graph blockers are not complete: canvas:upstream."
    });
    expect(readiness.claimHints.find((hint) => hint.ref === "T-001#B-001")).toMatchObject({
      ready: false,
      statusReason: "Project graph blockers are not complete: canvas:upstream."
    });
  });

  it("previews deterministic parallel batches through the same interface", async () => {
    const { root } = await createTestWorkspace(basicManifest({ includeSecondTask: true, parallel: true, maxConcurrent: 2 }));
    const context = await loadRuntime({ projectRoot: root });

    const readiness = buildClaimReadiness(context);

    expect(readiness.parallelBatchRefs).toEqual(["T-001#B-001", "T-002#B-001"]);
  });
});
