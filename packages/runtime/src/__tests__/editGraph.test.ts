import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { addEdge, addNode, updatePromptSurface } from "../graph/editGraph.js";
import { readJsonFile } from "../json.js";
import type { PlanPackageManifest } from "../types.js";
import { basicManifest, createTestWorkspace } from "./promptTestHelpers.js";

describe("editGraph", () => {
  it("adds v1 task nodes with prompt source files and reports affected tasks", async () => {
    const { root, init } = await createTestWorkspace();
    const node = basicManifest({ includeSecondTask: true }).nodes.find((item) => item.type === "task" && item.id === "T-002");
    if (!node || node.type !== "task") {
      throw new Error("missing task");
    }

    const result = await addNode({ projectRoot: root, node, promptMarkdown: "# New task\n" });
    const manifest = await readJsonFile<PlanPackageManifest>(init.workspace.manifestFile);

    expect(result.ok).toBe(true);
    expect(result.affectedTasks).toEqual(["T-002"]);
    expect(manifest.nodes.some((item) => item.id === "T-002")).toBe(true);
    await expect(readFile(`${init.workspace.packageDir}/nodes/T-002/prompt.md`, "utf8")).resolves.toContain("# New task");
  });

  it("validates edge endpoint contracts before writing", async () => {
    const { root } = await createTestWorkspace();

    const result = await addEdge({ projectRoot: root, edge: { from: "G-001", to: "T-001", type: "depends_on" } });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("depends_on_non_task");
  });

  it("updates the task prompt source rather than a rendered task surface", async () => {
    const { root, init } = await createTestWorkspace();

    const result = await updatePromptSurface({ projectRoot: root, taskId: "T-001", taskBody: "# Updated task prompt\n" });

    expect(result.ok).toBe(true);
    await expect(readFile(`${init.workspace.packageDir}/nodes/T-001/prompt.md`, "utf8")).resolves.toContain("# Updated task prompt");
  });
});
