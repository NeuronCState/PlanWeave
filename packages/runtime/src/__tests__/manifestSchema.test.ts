import { describe, expect, it } from "vitest";
import { manifestSchema } from "../schema/manifest.js";

describe("manifest schema", () => {
  it("accepts MVP-0 task and context nodes", () => {
    const manifest = manifestSchema.parse({
      version: "plan-package/v0",
      project: { title: "PlanWeave", description: "" },
      execution: { parallel: { enabled: true, maxConcurrent: 2 } },
      global_prompt: "global-prompt.md",
      nodes: [
        { id: "G-001", type: "goal", title: "Goal", summary: "Keep context visible." },
        {
          id: "T-001",
          type: "task",
          title: "Task",
          prompt: "nodes/T-001.prompt.md",
          acceptance: ["works"],
          parallel: { safe: true, locks: ["runtime"] }
        }
      ],
      edges: [{ from: "T-001", to: "G-001", type: "implements" }]
    });

    expect(manifest.nodes).toHaveLength(2);
  });

  it("rejects removed core schema fields", () => {
    expect(() =>
      manifestSchema.parse({
        version: "plan-package/v0",
        project: { title: "PlanWeave", description: "" },
        execution: { parallel: { enabled: false, maxConcurrent: 1 } },
        global_prompt: "global-prompt.md",
        graph_review: "graph-review.md",
        nodes: [],
        edges: []
      })
    ).toThrow();
  });
});
