import { access, mkdir, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { readJsonFile, writeJsonFile } from "../json.js";
import { resolvePackageWorkspace } from "../package/loadPackage.js";
import type { PackageWorkspaceRef } from "../types.js";
import type { DesktopLayout } from "./types.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function defaultLayout(projectId: string): DesktopLayout {
  return {
    version: "desktop-layout/v1",
    projectId,
    nodes: [],
    updatedAt: new Date(0).toISOString()
  };
}

async function layoutPath(projectRoot: PackageWorkspaceRef): Promise<string> {
  const workspace = await resolvePackageWorkspace(projectRoot);
  return join(workspace.workspaceRoot, "desktop", "layout.json");
}

export async function getDesktopLayout(projectRoot: PackageWorkspaceRef): Promise<DesktopLayout> {
  const workspace = await resolvePackageWorkspace(projectRoot);
  const path = await layoutPath(projectRoot);
  if (!(await exists(path))) {
    return defaultLayout(workspace.id);
  }
  return readJsonFile<DesktopLayout>(path);
}

export async function saveDesktopLayout(projectRoot: PackageWorkspaceRef, layout: DesktopLayout): Promise<DesktopLayout> {
  const workspace = await resolvePackageWorkspace(projectRoot);
  const next: DesktopLayout = {
    ...layout,
    version: "desktop-layout/v1",
    projectId: workspace.id,
    updatedAt: new Date().toISOString()
  };
  const path = await layoutPath(projectRoot);
  await mkdir(dirname(path), { recursive: true });
  await writeJsonFile(path, next);
  return next;
}

export async function resetDesktopLayout(projectRoot: PackageWorkspaceRef): Promise<DesktopLayout> {
  const workspace = await resolvePackageWorkspace(projectRoot);
  await rm(await layoutPath(projectRoot), { force: true });
  return defaultLayout(workspace.id);
}
