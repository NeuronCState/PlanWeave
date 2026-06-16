import { access, mkdir, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { readJsonFile, writeJsonFile } from "../json.js";
import { loadPackage, resolvePackageWorkspace } from "../package/loadPackage.js";
import type { PackageWorkspaceRef, PlanPackageManifest, ProjectWorkspace, ValidationIssue } from "../types.js";
import type { DesktopLayout, DesktopLayoutNode } from "./types.js";

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

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeLayoutNode(value: unknown): DesktopLayoutNode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const nodeId = typeof record.nodeId === "string" && record.nodeId.trim() ? record.nodeId : null;
  const x = finiteNumber(record.x);
  const y = finiteNumber(record.y);
  if (!nodeId || x === null || y === null) {
    return null;
  }
  return { nodeId, x, y };
}

function normalizeLegacyLayoutNode(nodeId: string, value: unknown): DesktopLayoutNode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const position = record.position;
  if (!position || typeof position !== "object" || Array.isArray(position)) {
    return null;
  }
  const coordinates = position as Record<string, unknown>;
  const x = finiteNumber(coordinates.x);
  const y = finiteNumber(coordinates.y);
  if (!nodeId.trim() || x === null || y === null) {
    return null;
  }
  return { nodeId, x, y };
}

function normalizeLayout(input: unknown, projectId: string): DesktopLayout {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return defaultLayout(projectId);
  }
  const raw = input as Record<string, unknown>;
  const updatedAt = typeof raw.updatedAt === "string" && raw.updatedAt.trim() ? raw.updatedAt : new Date(0).toISOString();
  if (Array.isArray(raw.nodes)) {
    return {
      version: "desktop-layout/v1",
      projectId,
      nodes: raw.nodes.flatMap((node) => {
        const normalized = normalizeLayoutNode(node);
        return normalized ? [normalized] : [];
      }),
      updatedAt
    };
  }
  if (raw.nodes && typeof raw.nodes === "object" && !Array.isArray(raw.nodes)) {
    return {
      version: "desktop-layout/v1",
      projectId,
      nodes: Object.entries(raw.nodes).flatMap(([nodeId, node]) => {
        const normalized = normalizeLegacyLayoutNode(nodeId, node);
        return normalized ? [normalized] : [];
      }),
      updatedAt
    };
  }
  return defaultLayout(projectId);
}

function validateLayoutShape(input: unknown): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    errors.push(issue("invalid_layout_schema", "Desktop layout must be a JSON object.", "desktop/layout.json"));
    return { errors, warnings };
  }
  const raw = input as Record<string, unknown>;
  if (Array.isArray(raw.nodes)) {
    if (raw.version !== "desktop-layout/v1") {
      errors.push(issue("invalid_layout_schema", "Desktop layout version must be 'desktop-layout/v1'.", "desktop/layout.json:version"));
    }
    if (typeof raw.projectId !== "string" || !raw.projectId.trim()) {
      errors.push(issue("invalid_layout_schema", "Desktop layout projectId must be a non-empty string.", "desktop/layout.json:projectId"));
    }
    if (typeof raw.updatedAt !== "string" || !raw.updatedAt.trim()) {
      errors.push(issue("invalid_layout_schema", "Desktop layout updatedAt must be an ISO timestamp string.", "desktop/layout.json:updatedAt"));
    }
    raw.nodes.forEach((node, index) => {
      if (!normalizeLayoutNode(node)) {
        errors.push(issue("invalid_layout_schema", "Desktop layout node must include nodeId, x, and y.", `desktop/layout.json:nodes.${index}`));
      }
    });
    return { errors, warnings };
  }
  if (raw.nodes && typeof raw.nodes === "object") {
    warnings.push(
      issue(
        "legacy_layout_schema",
        "Desktop layout uses legacy object-map nodes; save the layout through desktop/runtime to migrate it to desktop-layout/v1.",
        "desktop/layout.json:nodes"
      )
    );
    for (const [nodeId, node] of Object.entries(raw.nodes)) {
      if (!normalizeLegacyLayoutNode(nodeId, node)) {
        errors.push(issue("invalid_layout_schema", "Legacy desktop layout node must include position.x and position.y.", `desktop/layout.json:nodes.${nodeId}`));
      }
    }
    return { errors, warnings };
  }
  errors.push(issue("invalid_layout_schema", "Desktop layout nodes must be an array of { nodeId, x, y } entries.", "desktop/layout.json:nodes"));
  return { errors, warnings };
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
  return getDesktopLayoutForPackage(workspace, manifest);
}

export async function getDesktopLayoutForPackage(workspace: ProjectWorkspace, manifest: PlanPackageManifest): Promise<DesktopLayout> {
  const path = layoutPathForWorkspace(workspace);
  if (!(await exists(path))) {
    return defaultLayout(workspace.id);
  }
  return filterLayoutNodes(normalizeLayout(await readJsonFile<unknown>(path), workspace.id), manifest);
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

export async function validateDesktopLayout(workspace: ProjectWorkspace, manifest: PlanPackageManifest): Promise<{
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}> {
  const path = layoutPathForWorkspace(workspace);
  if (!(await exists(path))) {
    return { errors: [], warnings: [] };
  }
  let rawLayout: unknown;
  try {
    rawLayout = await readJsonFile<unknown>(path);
  } catch (error) {
    return {
      errors: [issue("layout_read_failed", error instanceof Error ? error.message : String(error), "desktop/layout.json")],
      warnings: []
    };
  }
  const report = validateLayoutShape(rawLayout);
  const layout = normalizeLayout(rawLayout, workspace.id);
  const nodeIds = manifestNodeIds(manifest);
  report.warnings.push(...layout.nodes
    .filter((node) => !nodeIds.has(node.nodeId))
    .map((node) =>
      issue(
        "stale_layout_reference",
        `Desktop layout references missing manifest node '${node.nodeId}'.`,
        `desktop/layout.json:${node.nodeId}`
      )
    ));
  return report;
}
