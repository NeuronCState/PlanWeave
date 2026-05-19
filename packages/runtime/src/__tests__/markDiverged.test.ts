import { describe, expect, it } from "vitest";
import { readState } from "../state.js";
import { markDiverged } from "../tasks/markDiverged.js";
import { markVerified } from "../tasks/markVerified.js";
import { createPackageWorkspace } from "./promptTestHelpers.js";

describe("markDiverged", () => {
  it("records divergence for a non-verified task", async () => {
    const { root, init } = await createPackageWorkspace();

    const result = await markDiverged({ projectRoot: root, taskId: "T-001", reason: "Plan changed." });
    const state = await readState(init.workspace.stateFile);

    expect(result.status).toBe("diverged");
    expect(state.tasks["T-001"]?.status).toBe("diverged");
    expect(state.tasks["T-001"]?.divergence?.reason).toBe("Plan changed.");
    delete process.env.PLANWEAVE_HOME;
  });

  it("does not mark verified tasks as diverged", async () => {
    const { root } = await createPackageWorkspace();
    await markVerified({ projectRoot: root, taskId: "T-001" });

    await expect(markDiverged({ projectRoot: root, taskId: "T-001", reason: "Plan changed." })).rejects.toThrow(
      "verified"
    );
    delete process.env.PLANWEAVE_HOME;
  });
});
