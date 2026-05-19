import { tasksHaveDependencyRelationship } from "./dependencies.js";
import type { ManifestTaskNode, PlanPackageManifest } from "../types.js";

export function canShareParallelBatch(
  manifest: PlanPackageManifest,
  selected: ManifestTaskNode[],
  candidate: ManifestTaskNode
): boolean {
  if (!candidate.parallel.safe) {
    return false;
  }
  for (const task of selected) {
    if (tasksHaveDependencyRelationship(manifest, task.id, candidate.id)) {
      return false;
    }
    const locks = new Set(task.parallel.locks);
    if (candidate.parallel.locks.some((lock) => locks.has(lock))) {
      return false;
    }
  }
  return true;
}
