import { join } from "node:path";
import { readJsonFile } from "../json.js";
import { resolveProjectWorkspace } from "../project.js";
import { manifestSchema } from "../schema/manifest.js";
import type { PlanPackageManifest, ProjectWorkspace } from "../types.js";

export type LoadedPlanPackage = {
  workspace: ProjectWorkspace;
  manifest: PlanPackageManifest;
};

export async function loadPackage(projectRoot: string): Promise<LoadedPlanPackage> {
  const workspace = await resolveProjectWorkspace(projectRoot);
  const raw = await readJsonFile<unknown>(join(workspace.packageDir, "manifest.json"));
  const manifest = manifestSchema.parse(raw) as PlanPackageManifest;
  return { workspace, manifest };
}
