import { dependencyIds } from "../state.js";
import type { PlanPackageManifest } from "../types.js";

export { dependencyIds };

export function hasDependencyPath(manifest: PlanPackageManifest, fromTaskId: string, toTaskId: string): boolean {
  const visited = new Set<string>();

  function visit(id: string): boolean {
    if (id === toTaskId) {
      return true;
    }
    if (visited.has(id)) {
      return false;
    }
    visited.add(id);
    return dependencyIds(manifest, id).some((next) => visit(next));
  }

  return visit(fromTaskId);
}

export function tasksHaveDependencyRelationship(manifest: PlanPackageManifest, left: string, right: string): boolean {
  return hasDependencyPath(manifest, left, right) || hasDependencyPath(manifest, right, left);
}
