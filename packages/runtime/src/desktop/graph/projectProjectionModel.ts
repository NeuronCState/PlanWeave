import { join, resolve } from "node:path";
import { stat } from "node:fs/promises";
import type { FileFingerprint, PackageWorkspaceRef, ValidationIssue } from "../../types.js";
import { resolveProjectWorkspace } from "../../project.js";
import { createPackageFileSnapshot } from "../../package/fileChanges.js";
import { projectGraphPath } from "../../projectGraph/index.js";
import {
  buildResultsFileIndex,
  sameResultsFileFingerprintSnapshot,
  snapshotResultsFileFingerprints,
  type ResultsFileFingerprintSnapshot,
  type ResultsFileIndex
} from "./resultsFileIndex.js";
import { buildSearchIndexFromProjectTodoContext, type DesktopSearchIndex } from "./searchIndexModel.js";
import { buildStatisticsProjectionFromIndexes, type DesktopStatisticsProjection } from "./statisticsIndexModel.js";
import { loadProjectTodoContext, type ProjectTodoContext } from "./todoModel.js";

export type DesktopProjectProjection = {
  projectRoot: string;
  todoContext: ProjectTodoContext;
  resultsByCanvas: Map<string, ResultsFileIndex>;
  diagnostics: ValidationIssue[];
};

type CachedProjectProjection = {
  projection: DesktopProjectProjection;
  fingerprints: DesktopProjectProjectionFingerprints;
  searchIndex: DesktopSearchIndex | null;
  statisticsProjection: DesktopStatisticsProjection | null;
};

const projectProjectionCache = new Map<string, CachedProjectProjection>();

type FileStatFingerprint = {
  path: string;
  mtimeMs: number;
  size: number;
};

type PackageInputFingerprint = {
  manifestFile: FileFingerprint;
  promptFiles: Record<string, FileFingerprint>;
};

type ProjectInputFingerprint = {
  projectFile: FileStatFingerprint | null;
  projectGraphFile: FileStatFingerprint | null;
  legacyCanvasRegistryFile: FileStatFingerprint | null;
};

type CanvasProjectionFingerprint = {
  packageFiles: PackageInputFingerprint | null;
  stateFile: FileStatFingerprint | null;
  results: ResultsFileFingerprintSnapshot;
};

type DesktopProjectProjectionFingerprints = {
  project: ProjectInputFingerprint;
  canvases: Map<string, CanvasProjectionFingerprint>;
};

function projectProjectionKey(projectRoot: PackageWorkspaceRef): string {
  return resolve(typeof projectRoot === "string" ? projectRoot : projectRoot.rootPath);
}

export function invalidateDesktopProjectProjection(projectRoot?: PackageWorkspaceRef): void {
  if (!projectRoot) {
    projectProjectionCache.clear();
    return;
  }
  projectProjectionCache.delete(projectProjectionKey(projectRoot));
}

async function buildDesktopProjectProjection(projectRoot: string): Promise<DesktopProjectProjection> {
  const todoContext = await loadProjectTodoContext(projectRoot);
  const diagnostics: ValidationIssue[] = [...todoContext.diagnostics];
  const resultsByCanvas = new Map<string, ResultsFileIndex>();

  for (const canvasId of todoContext.aggregation.orderedCanvasIds) {
    const canvas = todoContext.aggregation.canvasesById.get(canvasId);
    if (!canvas) {
      continue;
    }
    const resultIndex = await buildResultsFileIndex(canvas.workspace);
    resultsByCanvas.set(canvasId, resultIndex);
  }

  return {
    projectRoot,
    todoContext,
    resultsByCanvas,
    diagnostics
  };
}

async function optionalFileStatFingerprint(path: string): Promise<FileStatFingerprint | null> {
  try {
    const metadata = await stat(path);
    return {
      path,
      mtimeMs: metadata.mtimeMs,
      size: metadata.size
    };
  } catch {
    return null;
  }
}

async function packageInputFingerprint(projectRoot: PackageWorkspaceRef): Promise<PackageInputFingerprint | null> {
  try {
    const snapshot = await createPackageFileSnapshot(projectRoot);
    return {
      manifestFile: snapshot.manifestFile,
      promptFiles: snapshot.promptFiles
    };
  } catch {
    return null;
  }
}

async function buildProjectInputFingerprint(projectRoot: string): Promise<ProjectInputFingerprint> {
  const workspace = await resolveProjectWorkspace(projectRoot);
  return {
    projectFile: await optionalFileStatFingerprint(workspace.projectFile),
    projectGraphFile: await optionalFileStatFingerprint(projectGraphPath(workspace)),
    legacyCanvasRegistryFile: await optionalFileStatFingerprint(join(workspace.workspaceRoot, "desktop", "canvases.json"))
  };
}

async function buildDesktopProjectProjectionFingerprints(projectRoot: string, projection: DesktopProjectProjection): Promise<DesktopProjectProjectionFingerprints> {
  const canvases = new Map<string, CanvasProjectionFingerprint>();
  for (const canvasId of projection.todoContext.aggregation.orderedCanvasIds) {
    const canvas = projection.todoContext.aggregation.canvasesById.get(canvasId);
    if (!canvas) {
      continue;
    }
    canvases.set(canvasId, {
      packageFiles: await packageInputFingerprint(canvas.workspace),
      stateFile: await optionalFileStatFingerprint(canvas.workspace.stateFile),
      results: await snapshotResultsFileFingerprints(canvas.workspace)
    });
  }
  return {
    project: await buildProjectInputFingerprint(projectRoot),
    canvases
  };
}

function sameFileStatFingerprint(left: FileStatFingerprint | null, right: FileStatFingerprint | null): boolean {
  return left?.path === right?.path && left?.mtimeMs === right?.mtimeMs && left?.size === right?.size;
}

function sameFileFingerprint(left: FileFingerprint | undefined, right: FileFingerprint | undefined): boolean {
  return left?.path === right?.path && left?.hash === right?.hash && left?.mtimeMs === right?.mtimeMs;
}

function samePromptFileFingerprints(left: Record<string, FileFingerprint>, right: Record<string, FileFingerprint>): boolean {
  const paths = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const path of paths) {
    if (!sameFileFingerprint(left[path], right[path])) {
      return false;
    }
  }
  return true;
}

function samePackageInputFingerprint(left: PackageInputFingerprint | null, right: PackageInputFingerprint | null): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return sameFileFingerprint(left.manifestFile, right.manifestFile) && samePromptFileFingerprints(left.promptFiles, right.promptFiles);
}

function sameProjectInputFingerprint(left: ProjectInputFingerprint, right: ProjectInputFingerprint): boolean {
  return sameFileStatFingerprint(left.projectFile, right.projectFile)
    && sameFileStatFingerprint(left.projectGraphFile, right.projectGraphFile)
    && sameFileStatFingerprint(left.legacyCanvasRegistryFile, right.legacyCanvasRegistryFile);
}

function sameCanvasProjectionFingerprint(left: CanvasProjectionFingerprint, right: CanvasProjectionFingerprint): boolean {
  return samePackageInputFingerprint(left.packageFiles, right.packageFiles)
    && sameFileStatFingerprint(left.stateFile, right.stateFile)
    && sameResultsFileFingerprintSnapshot(left.results, right.results);
}

async function cachedProjectionIsFresh(cached: CachedProjectProjection): Promise<boolean> {
  let current: DesktopProjectProjectionFingerprints;
  try {
    current = await buildDesktopProjectProjectionFingerprints(cached.projection.projectRoot, cached.projection);
  } catch {
    return false;
  }
  if (!sameProjectInputFingerprint(cached.fingerprints.project, current.project)) {
    return false;
  }
  if (current.canvases.size !== cached.fingerprints.canvases.size) {
    return false;
  }
  for (const [canvasId, fingerprint] of cached.fingerprints.canvases) {
    const next = current.canvases.get(canvasId);
    if (!next || !sameCanvasProjectionFingerprint(fingerprint, next)) {
      return false;
    }
  }
  return true;
}

export async function readDesktopProjectProjection(projectRoot: string): Promise<DesktopProjectProjection> {
  const key = projectProjectionKey(projectRoot);
  const cached = projectProjectionCache.get(key);
  if (cached && await cachedProjectionIsFresh(cached)) {
    return cached.projection;
  }
  const projection = await buildDesktopProjectProjection(projectRoot);
  projectProjectionCache.set(key, {
    projection,
    fingerprints: await buildDesktopProjectProjectionFingerprints(projectRoot, projection),
    searchIndex: null,
    statisticsProjection: null
  });
  return projection;
}

export async function readDesktopProjectSearchIndex(projectRoot: string): Promise<DesktopSearchIndex> {
  const key = projectProjectionKey(projectRoot);
  const projection = await readDesktopProjectProjection(projectRoot);
  const cached = projectProjectionCache.get(key);
  if (cached?.searchIndex) {
    return cached.searchIndex;
  }
  const searchIndex = await buildSearchIndexFromProjectTodoContext(projection.todoContext, projection.resultsByCanvas);
  if (cached) {
    cached.searchIndex = searchIndex;
  }
  return searchIndex;
}

export async function readDesktopProjectStatisticsProjection(projectRoot: string): Promise<DesktopStatisticsProjection> {
  const key = projectProjectionKey(projectRoot);
  const projection = await readDesktopProjectProjection(projectRoot);
  const cached = projectProjectionCache.get(key);
  if (cached?.statisticsProjection) {
    return cached.statisticsProjection;
  }
  const statisticsProjection = buildStatisticsProjectionFromIndexes(projection.todoContext, projection.resultsByCanvas);
  if (cached) {
    cached.statisticsProjection = statisticsProjection;
  }
  return statisticsProjection;
}
