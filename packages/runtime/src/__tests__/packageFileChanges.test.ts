import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createPackageFileSnapshot,
  detectPackageFileChanges,
  refreshChangedPackagePrompts
} from "../package/fileChanges.js";
import { createPackageWorkspace } from "./promptTestHelpers.js";

describe("package file change detection", () => {
  it("detects global prompt changes and refreshes affected Prompt Surfaces", async () => {
    const { root, init } = await createPackageWorkspace();
    const snapshot = await createPackageFileSnapshot(root);

    await writeFile(join(init.workspace.packageDir, "global-prompt.md"), "Updated global rules.\n", "utf8");
    const result = await refreshChangedPackagePrompts(root, snapshot);
    const prompt = await readFile(join(init.workspace.packageDir, "nodes", "T-001.prompt.md"), "utf8");

    expect(result.impact).toMatchObject({ ok: true, affectedTasks: ["T-001"], fullRefresh: false });
    expect(result.refreshed.map((surface) => surface.taskId)).toEqual(["T-001"]);
    expect(prompt).toContain("Updated global rules.");
    delete process.env.PLANWEAVE_HOME;
  });

  it("detects direct task prompt edits without guessing manifest changes from markdown", async () => {
    const { root, init } = await createPackageWorkspace();
    const snapshot = await createPackageFileSnapshot(root);
    const promptPath = join(init.workspace.packageDir, "nodes", "T-001.prompt.md");

    await writeFile(
      promptPath,
      "<!-- planweave:user:start task-body -->\nUser edited body.\n<!-- planweave:user:end task-body -->\n",
      "utf8"
    );
    const result = await detectPackageFileChanges(root, snapshot);

    expect(result.impact).toMatchObject({ ok: true, affectedTasks: ["T-001"], fullRefresh: false });
    delete process.env.PLANWEAVE_HOME;
  });

  it("reports changed stale prompt files as diagnostics", async () => {
    const { root, init } = await createPackageWorkspace();
    const stalePath = join(init.workspace.packageDir, "nodes", "stale.prompt.md");
    await writeFile(stalePath, "old\n", "utf8");
    const snapshot = await createPackageFileSnapshot(root);

    await writeFile(stalePath, "new\n", "utf8");
    const result = await detectPackageFileChanges(root, snapshot);

    expect(result.impact.diagnostics.map((diagnostic) => diagnostic.code)).toContain("stale_prompt_reference");
    delete process.env.PLANWEAVE_HOME;
  });
});
