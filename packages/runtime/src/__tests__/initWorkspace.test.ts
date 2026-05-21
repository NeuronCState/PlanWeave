import { access, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initWorkspace } from "../initWorkspace.js";
import { readJsonFile } from "../json.js";

describe("initWorkspace", () => {
  it("creates a v1 workspace with separate global and project prompts", async () => {
    const home = await mkdtemp(join(tmpdir(), "planweave-home-"));
    const root = await mkdtemp(join(tmpdir(), "planweave-project-"));
    process.env.PLANWEAVE_HOME = home;

    const result = await initWorkspace({ projectRoot: root });
    const manifest = await readJsonFile<Record<string, unknown>>(result.workspace.manifestFile);
    const state = await readJsonFile<Record<string, unknown>>(result.workspace.stateFile);

    expect(manifest.version).toBe("plan-package/v1");
    expect(manifest).not.toHaveProperty("global_prompt");
    await expect(access(join(home, "config", "global-prompt.md"))).resolves.toBeUndefined();
    await expect(readFile(result.workspace.projectPromptFile, "utf8")).resolves.toContain("# Project Prompt");
    expect(state).toEqual({ currentRefs: [], currentFeedbackId: null, currentReviewBlockRef: null, tasks: {}, blocks: {}, feedback: {} });
    delete process.env.PLANWEAVE_HOME;
  });
});
