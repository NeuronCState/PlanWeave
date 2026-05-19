import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { refreshPrompt } from "../prompt/refreshPrompt.js";
import { createPackageWorkspace } from "./promptTestHelpers.js";

describe("refreshPrompt", () => {
  it("refreshes managed sections while preserving task-body", async () => {
    const { root, init } = await createPackageWorkspace();

    const result = await refreshPrompt({ projectRoot: root, taskId: "T-001" });
    const written = await readFile(result.path, "utf8");

    expect(result.markdown).toContain("<!-- planweave:managed:start header -->");
    expect(result.markdown).toContain("<!-- planweave:managed:start graph-context -->");
    expect(result.markdown).toContain("Keep this body.");
    expect(written).toBe(result.markdown);
    expect(result.path).toContain(init.workspace.packageDir);
    delete process.env.PLANWEAVE_HOME;
  });

  it("does not invent a missing task-body user section", async () => {
    const { root } = await createPackageWorkspace(undefined, "No user section\n");

    await expect(refreshPrompt({ projectRoot: root, taskId: "T-001" })).rejects.toThrow("task-body");
    delete process.env.PLANWEAVE_HOME;
  });
});
