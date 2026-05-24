import { access, mkdir, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { readJsonFile, writeJsonFile } from "../json.js";
import { loadPackage, resolvePackageWorkspace } from "../package/loadPackage.js";
import type { PackageWorkspaceRef, PlanPackageManifest, ProjectWorkspace, ValidationIssue } from "../types.js";
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

function layoutPathForWorkspace(workspace: ProjectWorkspace): string {
  return join(workspace.workspaceRoot, "desktop", "layout.json");
}

async function layoutPath(projectRoot: PackageWorkspaceRef): Promise<string> {
  return layoutPathForWorkspace(await resolvePackageWorkspace(projectRoot));
}

function manifestNodeIds(manifest: PlanPackageManifest): Set<string> {
  return new Set(manifest.nodes.map((node) => node.id));
}

function filterLayoutNodes(layout: DesktopLayout, manifest: PlanPackageManifest): DesktopLayout {
  const nodeIds = manifestNodeIds(manifest);
  return {
    ...layout,
    nodes: layout.nodes.filter((node) => nodeIds.has(node.nodeId))
  };
}

function issue(code: string, message: string, path?: string): ValidationIssue {
  return { code, message, path };
}

export async function getDesktopLayout(projectRoot: PackageWorkspaceRef): Promise<DesktopLayout> {
  const { workspace, manifest } = await loadPackage(projectRoot);
  const path = layoutPathForWorkspace(workspace);
  if (!(await exists(path))) {
    return defaultLayout(workspace.id);
  }
  return filterLayoutNodes(await readJsonFile<DesktopLayout>(path), manifest);
}

export async function saveDesktopLayout(projectRoot: PackageWorkspaceRef, layout: DesktopLayout): Promise<DesktopLayout> {
  const { workspace, manifest } = await loadPackage(projectRoot);
  const next = filterLayoutNodes({
    ...layout,
    version: "desktop-layout/v1",
    projectId: workspace.id,
    updatedAt: new Date().toISOString()
  }, manifest);
  const path = layoutPathForWorkspace(workspace);
  await mkdir(dirname(path), { recursive: true });
  await writeJsonFile(path, next);
  return next;
}

export async function resetDesktopLayout(projectRoot: PackageWorkspaceRef): Promise<DesktopLayout> {
  const workspace = await resolvePackageWorkspace(projectRoot);
  await rm(await layoutPath(projectRoot), { force: true });
  return defaultLayout(workspace.id);
}

export async function validateDesktopLayoutReferences(workspace: ProjectWorkspace, manifest: PlanPackageManifest): Promise<ValidationIssue[]> {
  const path = layoutPathForWorkspace(workspace);
  if (!(await exists(path))) {
    return [];
  }
  const layout = await readJsonFile<DesktopLayout>(path);
  const nodeIds = manifestNodeIds(manifest);
  return layout.nodes
    .filter((node) => !nodeIds.has(node.nodeId))
    .map((node) =>
      issue(
        "stale_layout_reference",
        `Desktop layout references missing manifest node '${node.nodeId}'.`,
        `desktop/layout.json:${node.nodeId}`
      )
    );
}
