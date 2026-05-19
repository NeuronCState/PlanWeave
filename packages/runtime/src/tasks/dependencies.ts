import { compileTaskGraph } from "../graph/compileTaskGraph.js";
import { dependencyIds } from "../state.js";
import type { CompiledTaskGraph, PlanPackageManifest } from "../types.js";

export { dependencyIds };

export function hasDependencyPath(
  manifest: PlanPackageManifest,
  fromTaskId: string,
  toTaskId: string,
  graph: CompiledTaskGraph = compileTaskGraph(manifest)
): boolean {
  return graph.reachable(fromTaskId, toTaskId);
}

export function tasksHaveDependencyRelationship(
  manifest: PlanPackageManifest,
  left: string,
  right: string,
  graph: CompiledTaskGraph = compileTaskGraph(manifest)
): boolean {
  return hasDependencyPath(manifest, left, right, graph) || hasDependencyPath(manifest, right, left, graph);
}
