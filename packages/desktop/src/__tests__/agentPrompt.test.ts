import { describe, expect, it } from "vitest";
import { buildAgentScopePrompt } from "../renderer/agentPrompt";

const project = {
  projectId: "P-001",
  rootPath: "/tmp/plan-project",
  sourceRoot: "/tmp/source-root"
};

describe("agent scope prompt", () => {
  it("builds canvas scope without skill or status summary", () => {
    expect(buildAgentScopePrompt({ project, canvasId: "default" })).toBe(
      "projectId: P-001\nprojectRoot: /tmp/plan-project\ncanvasId: default\nsourceRoot: /tmp/source-root"
    );
  });

  it("adds task_id only when task scope is present", () => {
    const prompt = buildAgentScopePrompt({ project, canvasId: "default", taskId: "T-001" });

    expect(prompt).toBe(
      "projectId: P-001\nprojectRoot: /tmp/plan-project\ncanvasId: default\nsourceRoot: /tmp/source-root\ntask_id: T-001"
    );
    expect(prompt).not.toContain("skill");
    expect(prompt).not.toContain("status");
  });
});
