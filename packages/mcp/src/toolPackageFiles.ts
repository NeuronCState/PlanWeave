import { constants } from "node:fs";
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import {
  createManagedProjectId,
  initManagedWorkspace,
  initOrOpenProject,
  openProject,
  resolvePlanweaveHome,
  resolveProjectWorkspace,
  resolveTaskCanvasWorkspace,
  validatePackage,
  type ValidationReport
} from "@planweave-ai/runtime";
import type { ExportedPlanPackage, ExportedPlanPackageFile } from "./toolTypes.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function exportCanvasPackage(projectId: string, canvasId?: string): Promise<ExportedPlanPackage> {
  const project = await openProject({ projectId });
  const workspace = await resolveTaskCanvasWorkspace(project.rootPath, canvasId);
  return {
    canvasId: canvasId ?? null,
    files: await readPackageFiles(workspace.packageDir)
  };
}

export async function importPackageFiles(
  name: string,
  files: ExportedPlanPackageFile[],
  overwrite: boolean
): Promise<{ project: Awaited<ReturnType<typeof initOrOpenProject>>; validation: ValidationReport; importedFiles: number }> {
  if (files.length === 0) {
    throw new Error("files must contain at least one PlanWeave package file.");
  }
  const normalizedFiles = files.map((file) => ({
    path: toArchivePath(file.path),
    content: file.content,
    encoding: file.encoding
  }));
  const tempRoot = await mkdtemp(join(tmpdir(), "planweave-mcp-import-"));
  try {
    const tempProject = await initOrOpenProject(join(tempRoot, "project"));
    const tempWorkspace = await resolveProjectWorkspace(tempProject.rootPath);
    await replacePackageFiles(tempWorkspace.packageDir, normalizedFiles);
    const tempValidation = await validatePackage({ projectRoot: tempProject.rootPath });
    if (!tempValidation.ok) {
      throw new Error(validationMessage("Imported PlanWeave package is invalid", tempValidation));
    }

    const projectId = createManagedProjectId(name);
    const projectFile = join(resolvePlanweaveHome(), "projects", projectId, "project.json");
    if ((await exists(projectFile)) && !overwrite) {
      throw new Error("Imported project already exists. Pass overwrite: true to replace its package files.");
    }
    const init = await initManagedWorkspace({ name });
    const workspace = await resolveProjectWorkspace(init.workspace.rootPath);
    await replacePackageFiles(workspace.packageDir, normalizedFiles);
    const validation = await validatePackage({ projectRoot: workspace.rootPath });
    if (!validation.ok) {
      throw new Error(validationMessage("Imported PlanWeave package became invalid after install", validation));
    }
    const project = await openProject({ projectId: init.project.id });
    return { project, validation, importedFiles: normalizedFiles.length };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function readPackageFiles(root: string): Promise<ExportedPlanPackageFile[]> {
  const files: ExportedPlanPackageFile[] = [];
  await visitPackageFile(root, root, files);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function visitPackageFile(root: string, dir: string, files: ExportedPlanPackageFile[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await visitPackageFile(root, path, files);
    } else if (entry.isFile()) {
      files.push({ path: toArchivePath(relative(root, path)), content: await readFile(path, "utf8"), encoding: "utf8" });
    }
  }
}

async function replacePackageFiles(root: string, files: ExportedPlanPackageFile[]): Promise<void> {
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  for (const file of files) {
    if (file.encoding !== "utf8") {
      throw new Error(`Unsupported file encoding '${file.encoding}' for '${file.path}'.`);
    }
    const path = safePackageFilePath(root, file.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.content, "utf8");
  }
}

function safePackageFilePath(root: string, archivePath: string): string {
  const target = resolve(root, archivePath.split("/").join(sep));
  const relativePath = relative(root, target);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error(`Package file path '${archivePath}' resolves outside the package directory.`);
  }
  return target;
}

function toArchivePath(value: string): string {
  const normalized = posix.normalize(value.replaceAll("\\", "/"));
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized === ".." || posix.isAbsolute(normalized)) {
    throw new Error(`Invalid package file path '${value}'.`);
  }
  return normalized;
}

function validationMessage(prefix: string, report: ValidationReport): string {
  const issues = [...report.errors, ...report.warnings].map((issue) => `${issue.code}: ${issue.message}`).join("; ");
  return issues ? `${prefix}: ${issues}` : prefix;
}
