import { describe, expect, it } from "vitest";
import { manifestSchema } from "../schema/manifest.js";
import { basicManifest } from "./promptTestHelpers.js";

describe("plan-package/v1 manifest schema", () => {
  it("accepts task nodes with implementation/check/review blocks", () => {
    expect(() => manifestSchema.parse(basicManifest())).not.toThrow();
  });

  it("rejects legacy manifest.global_prompt", () => {
    const manifest = { ...basicManifest(), global_prompt: "global-prompt.md" };

    const result = manifestSchema.safeParse(manifest);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain("manifest.global_prompt is not supported in plan-package/v1.");
  });

  it("rejects feedback as a block type", () => {
    const manifest = basicManifest();
    const task = manifest.nodes.find((node) => node.type === "task");
    if (task?.type !== "task") {
      throw new Error("missing task");
    }
    task.blocks.push({
      id: "F-001",
      type: "feedback",
      title: "Feedback",
      prompt: "nodes/T-001/blocks/F-001.prompt.md",
      depends_on: []
    } as never);

    const result = manifestSchema.safeParse(manifest);

    expect(result.success).toBe(false);
  });
});
