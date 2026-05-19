import { describe, expect, it } from "vitest";
import { claimNextTask } from "../tasks/claimNext.js";
import { readState, writeState } from "../state.js";
import { createPackageWorkspace } from "./promptTestHelpers.js";

describe("claimNextTask", () => {
  it("claims the first ready task and returns it while in progress", async () => {
    const { root, init } = await createPackageWorkspace();

    const first = await claimNextTask({ projectRoot: root });
    const second = await claimNextTask({ projectRoot: root });

    expect(first).toMatchObject({ taskId: "T-001", status: "claimed" });
    expect(second).toMatchObject({ taskId: "T-001", status: "current" });
    delete process.env.PLANWEAVE_HOME;
    await readState(init.workspace.stateFile);
  });

  it("prioritizes needs_changes over ready tasks", async () => {
    const { root, init } = await createPackageWorkspace();
    const state = await readState(init.workspace.stateFile);
    state.tasks["T-001"] = { status: "needs_changes", claimedBy: null, lastRunId: "RUN-001", blockedBy: [] };
    await writeState(init.workspace.stateFile, state);

    const result = await claimNextTask({ projectRoot: root });

    expect(result).toMatchObject({ taskId: "T-001", status: "claimed" });
    delete process.env.PLANWEAVE_HOME;
  });
});
