import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initWorkspace } from "../initWorkspace.js";
import { writeJsonFile } from "../json.js";
import type { InitWorkspaceResult, PlanPackageManifest } from "../types.js";

export function baseManifest(overrides: Partial<PlanPackageManifest> = {}): PlanPackageManifest {
  return {
    version: "plan-package/v0",
    project: { title: "Project", description: "" },
    execution: { parallel: { enabled: false, maxConcurrent: 1 } },
    global_prompt: "global-prompt.md",
    nodes: [
      { id: "G-001", type: "goal", title: "Goal", summary: "Keep context visible." },
      {
        id: "T-001",
        type: "task",
        title: "Implement task",
        prompt: "nodes/T-001.prompt.md",
        acceptance: ["Code works", "Tests pass"],
        parallel: { safe: true, locks: ["runtime"] }
      }
    ],
    edges: [{ from: "T-001", to: "G-001", type: "implements" }],
    ...overrides
  };
}

export async function createPackageWorkspace(
  manifest: PlanPackageManifest = baseManifest(),
  prompt = "<!-- planweave:user:start task-body -->\nKeep this body.\n<!-- planweave:user:end task-body -->\n"
): Promise<{ root: string; init: InitWorkspaceResult }> {
  const home = await mkdtemp(join(tmpdir(), "planweave-home-"));
  const root = await mkdtemp(join(tmpdir(), "planweave-project-"));
  process.env.PLANWEAVE_HOME = home;
  const init = await initWorkspace({ projectRoot: root });
  await mkdir(join(init.workspace.packageDir, "nodes"), { recursive: true });
  await writeJsonFile(init.workspace.manifestFile, manifest);
  await writeFile(join(init.workspace.packageDir, "global-prompt.md"), "Follow project rules.\n", "utf8");
  await writeFile(join(init.workspace.packageDir, "nodes", "T-001.prompt.md"), prompt, "utf8");
  return { root, init };
}
