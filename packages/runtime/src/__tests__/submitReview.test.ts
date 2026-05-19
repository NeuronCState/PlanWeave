import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readState } from "../state.js";
import { readResultIndex } from "../results/indexFile.js";
import { submitRunResult } from "../results/submitResult.js";
import { submitReview } from "../results/submitReview.js";
import { markVerified } from "../tasks/markVerified.js";
import { createPackageWorkspace } from "./promptTestHelpers.js";

describe("submitReview and markVerified", () => {
  it("updates review without creating a run and moves task to needs_changes", async () => {
    const { root, init } = await createPackageWorkspace();
    const implementation = join(init.workspace.workspaceRoot, "implementation.md");
    const review = join(init.workspace.workspaceRoot, "review.md");
    await writeFile(implementation, "Implemented.\n", "utf8");
    await writeFile(review, "Please revise.\n", "utf8");
    await submitRunResult({ projectRoot: root, taskId: "T-001", reportPath: implementation });

    const result = await submitReview({ projectRoot: root, taskId: "T-001", reportPath: review, status: "needs_changes" });
    const state = await readState(init.workspace.stateFile);

    expect(result.taskStatus).toBe("needs_changes");
    expect(result.index.runCount).toBe(1);
    expect(state.tasks["T-001"]?.status).toBe("needs_changes");
    delete process.env.PLANWEAVE_HOME;
  });

  it("rejects unsupported review statuses before mutating state or review", async () => {
    const { root, init } = await createPackageWorkspace();
    const implementation = join(init.workspace.workspaceRoot, "implementation.md");
    const review = join(init.workspace.workspaceRoot, "review.md");
    await writeFile(implementation, "Implemented.\n", "utf8");
    await writeFile(review, "Bogus review.\n", "utf8");
    await submitRunResult({ projectRoot: root, taskId: "T-001", reportPath: implementation });

    await expect(
      submitReview({
        projectRoot: root,
        taskId: "T-001",
        reportPath: review,
        // @ts-expect-error exercises runtime validation for untyped callers.
        status: "bogus"
      })
    ).rejects.toThrow("Unsupported submit-review status 'bogus'.");

    const state = await readState(init.workspace.stateFile);
    const index = await readResultIndex(join(init.workspace.resultsDir, "T-001", "index.json"));
    expect(state.tasks["T-001"]?.status).toBe("implemented");
    expect(index?.status).toBe("implemented");
    expect(index?.review).toBeUndefined();
    delete process.env.PLANWEAVE_HOME;
  });

  it("can explicitly mark a task verified", async () => {
    const { root, init } = await createPackageWorkspace();

    await markVerified({ projectRoot: root, taskId: "T-001" });
    const state = await readState(init.workspace.stateFile);

    expect(state.tasks["T-001"]?.status).toBe("verified");
    delete process.env.PLANWEAVE_HOME;
  });
});
