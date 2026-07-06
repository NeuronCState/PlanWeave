import { describe, expect, it } from "vitest";
import { getDesktopGraphDiagnostics } from "../desktop/diagnosticsApi.js";
import { writeJsonFile } from "../json.js";
import type { RuntimeState } from "../types.js";
import { basicManifest, createTestWorkspace } from "./promptTestHelpers.js";

function emptyState(overrides: Partial<RuntimeState>): RuntimeState {
  return {
    currentRefs: [],
    currentFeedbackId: null,
    currentReviewBlockRef: null,
    tasks: {},
    blocks: {},
    feedback: {},
    ...overrides
  };
}

describe("getDesktopGraphDiagnostics", () => {
  it("maps graph quality diagnostics into desktop diagnostics with repair metadata", async () => {
    const { root } = await createTestWorkspace(basicManifest({ includeSecondTask: true }));

    const result = await getDesktopGraphDiagnostics(root);

    expect(result.graphQuality.ok).toBe(true);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "task_orphaned",
        source: "graph_quality",
        severity: "warning",
        suggestedTool: "add_task_dependency"
      })
    );
  });

  it("maps execution readiness diagnostics into desktop diagnostics", async () => {
    const { init, root } = await createTestWorkspace();
    await writeJsonFile(
      init.workspace.stateFile,
      emptyState({
        blocks: {
          "T-001#B-001": { status: "blocked", blockedReason: "external dependency" },
          "T-001#R-001": { status: "planned" }
        }
      })
    );

    const result = await getDesktopGraphDiagnostics(root);

    expect(result.executionReadiness.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "no_ready_blocks",
        source: "execution_readiness",
        severity: "error",
        suggestedTool: "validate_project"
      })
    );
  });
});
