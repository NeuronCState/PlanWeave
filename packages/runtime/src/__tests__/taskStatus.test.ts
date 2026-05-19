import { describe, expect, it } from "vitest";
import { readTaskStatusSnapshot } from "../tasks/status.js";
import { createPackageWorkspace, baseManifest } from "./promptTestHelpers.js";

describe("task status", () => {
  it("derives ready and planned task state from manifest dependencies", async () => {
    const { root } = await createPackageWorkspace(
      baseManifest({
        nodes: [
          {
            id: "T-001",
            type: "task",
            title: "First",
            prompt: "nodes/T-001.prompt.md",
            acceptance: ["done"],
            parallel: { safe: true, locks: [] }
          },
          {
            id: "T-002",
            type: "task",
            title: "Second",
            prompt: "nodes/T-001.prompt.md",
            acceptance: ["done"],
            parallel: { safe: true, locks: [] }
          }
        ],
        edges: [{ from: "T-002", to: "T-001", type: "depends_on" }]
      })
    );

    const snapshot = await readTaskStatusSnapshot(root);

    expect(snapshot.state.tasks["T-001"]?.status).toBe("ready");
    expect(snapshot.state.tasks["T-002"]?.status).toBe("planned");
    expect(snapshot.state.tasks["T-002"]?.blockedBy).toEqual(["T-001"]);
    delete process.env.PLANWEAVE_HOME;
  });
});
