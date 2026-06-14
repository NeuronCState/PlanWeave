import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initWorkspace } from "../initWorkspace.js";
import { writeJsonFile } from "../json.js";
import { readProjectPaths } from "../paths.js";
import { projectGraphPath } from "../projectGraph/index.js";
import { basicManifest, writePromptFiles } from "./promptTestHelpers.js";

describe("readProjectPaths", () => {
  it("returns stable agent-facing workspace paths after init", async () => {
    const home = await mkdtemp(join(tmpdir(), "planweave-home-"));
    const root = await mkdtemp(join(tmpdir(), "planweave-project-"));
    process.env.PLANWEAVE_HOME = home;
    const init = await initWorkspace({ projectRoot: root });

    const paths = await readProjectPaths(root);

    expect(paths).toEqual({
      workspaceDir: home,
      projectId: init.workspace.id,
      projectDir: init.workspace.workspaceRoot,
      projectGraphPath: join(init.workspace.workspaceRoot, "project-graph.json"),
      packageDir: init.workspace.packageDir,
      statePath: init.workspace.stateFile,
      resultsDir: init.workspace.resultsDir,
      activeCanvasId: "default",
      canvases: [
        {
          canvasId: "default",
          name: init.project.name,
          packageDir: init.workspace.packageDir,
          statePath: init.workspace.stateFile,
          resultsDir: init.workspace.resultsDir
        }
      ]
    });
    delete process.env.PLANWEAVE_HOME;
  });

  it("returns formal project graph canvas paths for agent preflight", async () => {
    const home = await mkdtemp(join(tmpdir(), "planweave-home-"));
    const root = await mkdtemp(join(tmpdir(), "planweave-project-"));
    process.env.PLANWEAVE_HOME = home;
    const init = await initWorkspace({ projectRoot: root });
    const secondPackageDir = join(init.workspace.workspaceRoot, "canvases", "desktop", "package");
    const secondManifest = basicManifest();
    await writeJsonFile(join(secondPackageDir, "manifest.json"), secondManifest);
    await writePromptFiles(secondPackageDir, secondManifest);
    await writeJsonFile(projectGraphPath(init.workspace), {
      version: "plan-project/v1",
      canvases: [
        {
          id: "runtime",
          type: "canvas",
          title: "Runtime",
          packageDir: "package",
          stateFile: "state.json",
          resultsDir: "results"
        },
        {
          id: "desktop",
          type: "canvas",
          title: "Desktop",
          packageDir: "canvases/desktop/package",
          stateFile: "canvases/desktop/state.json",
          resultsDir: "canvases/desktop/results"
        }
      ],
      edges: [],
      crossTaskEdges: []
    });

    const paths = await readProjectPaths(root);

    expect(paths.projectGraphPath).toBe(join(init.workspace.workspaceRoot, "project-graph.json"));
    expect(paths.activeCanvasId).toBe("runtime");
    expect(paths.canvases).toEqual([
      {
        canvasId: "runtime",
        name: "Runtime",
        packageDir: init.workspace.packageDir,
        statePath: init.workspace.stateFile,
        resultsDir: init.workspace.resultsDir
      },
      {
        canvasId: "desktop",
        name: "Desktop",
        packageDir: secondPackageDir,
        statePath: join(init.workspace.workspaceRoot, "canvases", "desktop", "state.json"),
        resultsDir: join(init.workspace.workspaceRoot, "canvases", "desktop", "results")
      }
    ]);
    delete process.env.PLANWEAVE_HOME;
  });

  it("does not create or imply a workspace when the project has not been initialized", async () => {
    const home = await mkdtemp(join(tmpdir(), "planweave-home-"));
    const root = await mkdtemp(join(tmpdir(), "planweave-project-"));
    process.env.PLANWEAVE_HOME = home;

    await expect(readProjectPaths(root)).rejects.toThrow("has not been initialized");
    delete process.env.PLANWEAVE_HOME;
  });
});
