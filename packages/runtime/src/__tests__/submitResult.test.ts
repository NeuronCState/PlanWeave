import { access } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claimNext, submitBlockResult } from "../taskManager/index.js";
import { createTestWorkspace, writeReport } from "./promptTestHelpers.js";

describe("submitBlockResult", () => {
  it("stores implementation reports under the block run history", async () => {
    const { root, init } = await createTestWorkspace();
    await claimNext({ projectRoot: root });

    const result = await submitBlockResult({ projectRoot: root, ref: "T-001#B-001", reportPath: await writeReport(root, "report.md") });

    expect(result).toEqual({ ref: "T-001#B-001", runId: "RUN-001", status: "completed" });
    await expect(access(join(init.workspace.resultsDir, "T-001", "blocks", "B-001", "runs", "RUN-001", "report.md"))).resolves.toBeUndefined();
  });

  it("does not accept review blocks", async () => {
    const { root } = await createTestWorkspace();

    await expect(
      submitBlockResult({ projectRoot: root, ref: "T-001#R-001", reportPath: await writeReport(root, "review.md") })
    ).rejects.toThrow("submit-result only accepts implementation/check blocks");
  });
});
