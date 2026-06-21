import { access, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initManagedWorkspace, initWorkspace } from "../initWorkspace.js";
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

  it("creates managed projects directly in the PlanWeave workspace registry", async () => {
    const home = await mkdtemp(join(tmpdir(), "planweave-home-"));
    process.env.PLANWEAVE_HOME = home;

    const result = await initManagedWorkspace({ name: "New Project" });
    const project = await readJsonFile<Record<string, unknown>>(result.workspace.projectFile);

    expect(result.workspace.kind).toBe("managed");
    expect(result.workspace.rootPath).toBe(result.workspace.workspaceRoot);
    expect(result.workspace.sourceRoot).toBeNull();
    expect(result.workspace.workspaceRoot).toBe(join(home, "projects", result.workspace.id));
    expect(project).toMatchObject({
      id: result.workspace.id,
      name: "New Project",
      rootPath: result.workspace.workspaceRoot,
      kind: "managed",
      sourceRoot: null
    });
    await expect(access(join(home, "mcp-projects"))).rejects.toThrow();
    delete process.env.PLANWEAVE_HOME;
  });
});
