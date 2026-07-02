import { optionalReadFile, optionalStat } from "../fs/optionalFile.js";
import { createExecutionGraphSession, drainGraphReadQueue } from "../graph/session.js";
import { loadPackage } from "../package/loadPackage.js";
import { ensureStateForManifest, readState, writeState } from "../state.js";
import type { CompiledExecutionGraph, ExecutionGraphSession, PackageWorkspaceRef, PlanPackageManifest, ProjectWorkspace, RuntimeState } from "../types.js";

export type RuntimeContext = {
  workspace: ProjectWorkspace;
  manifest: PlanPackageManifest;
  graph: CompiledExecutionGraph;
  state: RuntimeState;
};

export type RuntimeOptions = {
  projectRoot: PackageWorkspaceRef;
  session?: ExecutionGraphSession;
};

export async function exists(path: string): Promise<boolean> {
  return (await optionalStat(path)) !== null;
}

export async function readOptionalFile(path: string): Promise<string> {
  return (await optionalReadFile(path, "utf8")) ?? "";
}

export async function loadRuntime(options: RuntimeOptions): Promise<RuntimeContext> {
  const { workspace, manifest: packageManifest } = await loadPackage(options.projectRoot);
  const session = options.session ?? (await createExecutionGraphSession(options.projectRoot));
  await drainGraphReadQueue(session);
  const manifest = options.session ? session.fileSnapshot.manifest : packageManifest;
  const graph = session.graph;
  const state = ensureStateForManifest(manifest, await readState(workspace.stateFile));
  await writeState(workspace.stateFile, state);
  return { workspace, manifest, graph, state };
}

export function refreshDerivedState(manifest: PlanPackageManifest, state: RuntimeState): RuntimeState {
  return ensureStateForManifest(manifest, state);
}
