import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { compilePackageGraph } from "../graph/compileTaskGraph.js";
import { affectedTasksForPackageFileChange, type PackageChangeImpact } from "../graph/editGraph.js";
import { loadPackage } from "./loadPackage.js";
import { refreshPrompt } from "../prompt/refreshPrompt.js";
import { refreshPrompts } from "../prompt/refreshPrompts.js";
import type { PlanPackageManifest, PromptSurface, ValidationIssue } from "../types.js";

type FileFingerprint = {
  path: string;
  hash: string;
  mtimeMs: number;
};

export type PackageFileSnapshot = {
  manifest: PlanPackageManifest;
  manifestFile: FileFingerprint;
  globalPrompt: FileFingerprint | null;
  promptFiles: Record<string, FileFingerprint>;
};

export type PackageFileSyncResult = {
  snapshot: PackageFileSnapshot | null;
  impact: PackageChangeImpact;
  refreshed: PromptSurface[];
};

function issue(code: string, message: string, path?: string): ValidationIssue {
  return { code, message, path };
}

async function fingerprint(path: string): Promise<FileFingerprint> {
  const [metadata, content] = await Promise.all([stat(path), readFile(path)]);
  return {
    path,
    hash: createHash("sha256").update(content).digest("hex"),
    mtimeMs: metadata.mtimeMs
  };
}

async function listMarkdownFiles(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await listMarkdownFiles(path)));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(path);
      }
    }
    return files;
  } catch {
    return [];
  }
}

function sameManifest(left: PlanPackageManifest, right: PlanPackageManifest): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function changed(left: FileFingerprint | null | undefined, right: FileFingerprint | null | undefined): boolean {
  return left?.hash !== right?.hash || left?.mtimeMs !== right?.mtimeMs;
}

function mergeImpact(left: PackageChangeImpact, right: PackageChangeImpact): PackageChangeImpact {
  const affectedTasks = [...new Set([...left.affectedTasks, ...right.affectedTasks])];
  return {
    ok: left.ok && right.ok,
    affectedTasks,
    diagnostics: [...left.diagnostics, ...right.diagnostics],
    fullRefresh: left.fullRefresh || right.fullRefresh,
    graph: right.graph ?? left.graph
  };
}

function taskByPromptPath(manifest: PlanPackageManifest): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of manifest.nodes) {
    if (node.type === "task") {
      map.set(node.prompt, node.id);
    }
  }
  return map;
}

export async function createPackageFileSnapshot(projectRoot: string): Promise<PackageFileSnapshot> {
  const { workspace, manifest } = await loadPackage(projectRoot);
  const promptFiles: Record<string, FileFingerprint> = {};
  for (const file of await listMarkdownFiles(join(workspace.packageDir, "nodes"))) {
    promptFiles[relative(workspace.packageDir, file)] = await fingerprint(file);
  }

  let globalPrompt: FileFingerprint | null = null;
  try {
    globalPrompt = await fingerprint(join(workspace.packageDir, manifest.global_prompt));
  } catch {
    globalPrompt = null;
  }

  return {
    manifest,
    manifestFile: await fingerprint(workspace.manifestFile),
    globalPrompt,
    promptFiles
  };
}

export async function detectPackageFileChanges(
  projectRoot: string,
  previous: PackageFileSnapshot
): Promise<{ snapshot: PackageFileSnapshot | null; impact: PackageChangeImpact }> {
  let snapshot: PackageFileSnapshot;
  try {
    snapshot = await createPackageFileSnapshot(projectRoot);
  } catch (error) {
    return {
      snapshot: null,
      impact: {
        ok: false,
        affectedTasks: [],
        diagnostics: [issue("package_change_detection_failed", error instanceof Error ? error.message : String(error))],
        fullRefresh: true
      }
    };
  }

  const { workspace } = await loadPackage(projectRoot);
  let impact: PackageChangeImpact = {
    ok: true,
    affectedTasks: [],
    diagnostics: [],
    fullRefresh: false,
    graph: await compilePackageGraph(snapshot.manifest, workspace.packageDir)
  };

  if (!sameManifest(previous.manifest, snapshot.manifest)) {
    impact = mergeImpact(impact, affectedTasksForPackageFileChange({ kind: "manifest", before: previous.manifest, after: snapshot.manifest }));
  }

  if (changed(previous.globalPrompt, snapshot.globalPrompt)) {
    impact = mergeImpact(impact, affectedTasksForPackageFileChange({ kind: "global-prompt", manifest: snapshot.manifest }));
  }

  const promptToTask = taskByPromptPath(snapshot.manifest);
  const promptPaths = new Set([...Object.keys(previous.promptFiles), ...Object.keys(snapshot.promptFiles)]);
  for (const path of promptPaths) {
    if (!changed(previous.promptFiles[path], snapshot.promptFiles[path])) {
      continue;
    }
    const taskId = promptToTask.get(path);
    if (!taskId) {
      impact = {
        ...impact,
        diagnostics: [...impact.diagnostics, issue("stale_prompt_reference", `Changed Prompt Surface '${path}' is not referenced by any task.`, path)]
      };
      continue;
    }
    impact = mergeImpact(impact, affectedTasksForPackageFileChange({ kind: "prompt", manifest: snapshot.manifest, taskId }));
  }

  return { snapshot, impact };
}

export async function refreshChangedPackagePrompts(
  projectRoot: string,
  previous: PackageFileSnapshot
): Promise<PackageFileSyncResult> {
  const detected = await detectPackageFileChanges(projectRoot, previous);
  if (!detected.snapshot || !detected.impact.ok) {
    return { ...detected, refreshed: [] };
  }

  if (detected.impact.fullRefresh) {
    const result = await refreshPrompts({ projectRoot });
    return { ...detected, refreshed: result.prompts };
  }

  const refreshed: PromptSurface[] = [];
  for (const taskId of detected.impact.affectedTasks) {
    refreshed.push(await refreshPrompt({ projectRoot, taskId }));
  }
  const snapshot = await createPackageFileSnapshot(projectRoot);
  return {
    snapshot,
    impact: detected.impact,
    refreshed
  };
}
