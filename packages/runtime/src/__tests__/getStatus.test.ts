import { realpath } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { markDiverged } from "../tasks/markDiverged.js";
import { getStatus } from "../status/getStatus.js";
import { createPackageWorkspace } from "./promptTestHelpers.js";

describe("getStatus", () => {
  it("reports project id, root, task total, counts, and current task", async () => {
    const { root } = await createPackageWorkspace();
    await markDiverged({ projectRoot: root, taskId: "T-001", reason: "Plan changed." });

    const status = await getStatus({ projectRoot: root });

    expect(status.projectRoot).toBe(await realpath(root));
    expect(status.taskTotal).toBe(1);
    expect(status.counts.diverged).toBe(1);
    expect(status.diverged).toBe(1);
    delete process.env.PLANWEAVE_HOME;
  });
});
