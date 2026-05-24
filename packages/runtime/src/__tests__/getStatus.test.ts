import { describe, expect, it } from "vitest";
import { claimNext, getExecutionStatus, submitBlockResult } from "../taskManager/index.js";
import { basicManifest, createTestWorkspace, writeReport } from "./promptTestHelpers.js";

describe("getExecutionStatus", () => {
  it("summarizes task, block, feedback, and current claim state", async () => {
    const { root } = await createTestWorkspace();
    await claimNext({ projectRoot: root });
    await submitBlockResult({ projectRoot: root, ref: "T-001#B-001", reportPath: await writeReport(root, "b.md") });

    const status = await getExecutionStatus({ projectRoot: root });

    expect(status.taskTotal).toBe(1);
    expect(status.blockTotal).toBe(3);
    expect(status.counts.blocks.completed).toBe(1);
    expect(status.counts.blocks.ready).toBe(1);
    expect(status.counts.feedback.open).toBe(0);
    expect(status.blocks.find((block) => block.ref === "T-001#B-001")?.lastRunId).toBe("RUN-001");
  });

  it("only lists blocks claimable after task upstream dependencies are satisfied", async () => {
    const { root } = await createTestWorkspace(basicManifest({ includeSecondTask: true, taskDependsOn: ["T-002"] }));

    const status = await getExecutionStatus({ projectRoot: root });
    const claim = await claimNext({ projectRoot: root });

    expect(status.nextClaimable).toEqual(["T-002#B-001"]);
    expect(status.counts.blocks.ready).toBe(1);
    expect(status.blocks.find((block) => block.ref === "T-001#B-001")?.status).toBe("planned");
    expect(claim).toMatchObject({ kind: "block", ref: "T-002#B-001" });
  });
});
