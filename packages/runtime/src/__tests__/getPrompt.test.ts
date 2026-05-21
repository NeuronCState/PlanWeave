import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderPrompt } from "../taskManager/index.js";
import { createTestWorkspace } from "./promptTestHelpers.js";

describe("renderPrompt", () => {
  it("renders global, project, task, block, graph, and submission instructions for a block ref", async () => {
    const { home, root, init } = await createTestWorkspace();
    await mkdir(join(home, "config"), { recursive: true });
    await writeFile(join(home, "config", "global-prompt.md"), "Global policy\n", "utf8");
    await writeFile(init.workspace.projectPromptFile, "Project policy\n", "utf8");

    const prompt = await renderPrompt({ projectRoot: root, ref: "T-001#B-001" });

    expect(prompt).toContain("Global policy");
    expect(prompt).toContain("Project policy");
    expect(prompt).toContain("# T-001 task prompt");
    expect(prompt).toContain("# T-001#B-001 implementation prompt");
    expect(prompt).toContain("planweave submit-result T-001#B-001 --report");
  });

  it("renders review result JSON instructions for review blocks", async () => {
    const { root } = await createTestWorkspace();

    const prompt = await renderPrompt({ projectRoot: root, ref: "T-001#R-001" });

    expect(prompt).toContain("Required Review Result JSON");
    expect(prompt).toContain('"reviewBlockRef": "T-001#R-001"');
    expect(prompt).toContain("planweave submit-review T-001#R-001 --result");
  });
});
