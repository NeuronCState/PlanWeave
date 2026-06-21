import { resolvePackageWorkspace } from "../package/loadPackage.js";
import type { PackageWorkspaceRef } from "../types.js";
import { executePlanGraphCommand } from "../plangraph/index.js";
import { validateDesktopLayout } from "../validation/desktopLayoutValidation.js";
import type { DesktopLayout } from "./types.js";
import {
  defaultDesktopLayout,
  desktopLayoutCommandStore,
  getDesktopLayoutDirect,
  getDesktopLayoutForPackage,
  resetDesktopLayoutDirect,
  saveDesktopLayoutDirect
} from "./layoutStore.js";

export { validateDesktopLayout };
export { getDesktopLayoutForPackage, saveDesktopLayoutDirect };

export async function getDesktopLayout(projectRoot: PackageWorkspaceRef): Promise<DesktopLayout> {
  return getDesktopLayoutDirect(projectRoot);
}

function graphCommandError(result: Awaited<ReturnType<typeof executePlanGraphCommand>>): Error {
  return new Error(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
}

export async function saveDesktopLayout(projectRoot: PackageWorkspaceRef, layout: DesktopLayout): Promise<DesktopLayout> {
  const result = await executePlanGraphCommand({
    projectRoot,
    command: { type: "updateLayout", layoutScope: "desktop", layout },
    dependencies: { layoutStore: desktopLayoutCommandStore }
  });
  if (!result.ok) {
    throw graphCommandError(result);
  }
  return getDesktopLayoutDirect(projectRoot);
}

export async function resetDesktopLayout(projectRoot: PackageWorkspaceRef): Promise<DesktopLayout> {
  const workspace = await resolvePackageWorkspace(projectRoot);
  const result = await executePlanGraphCommand({
    projectRoot,
    command: { type: "updateLayout", layoutScope: "desktop", layout: defaultDesktopLayout(workspace.id) },
    dependencies: { layoutStore: desktopLayoutCommandStore }
  });
  if (!result.ok) {
    throw graphCommandError(result);
  }
  const layout = await getDesktopLayoutDirect(projectRoot);
  if (layout.nodes.length === 0) {
    return resetDesktopLayoutDirect(projectRoot);
  }
  return layout;
}
