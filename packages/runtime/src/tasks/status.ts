import { loadPackage } from "../package/loadPackage.js";
import { ensureStateForManifest, readState, writeState } from "../state.js";
import type { PlanPackageManifest, RuntimeState } from "../types.js";

export type TaskStatusSnapshot = {
  manifest: PlanPackageManifest;
  state: RuntimeState;
};

export async function readTaskStatusSnapshot(projectRoot: string): Promise<TaskStatusSnapshot> {
  const { workspace, manifest } = await loadPackage(projectRoot);
  const state = ensureStateForManifest(manifest, await readState(workspace.stateFile));
  await writeState(workspace.stateFile, state);
  return { manifest, state };
}
