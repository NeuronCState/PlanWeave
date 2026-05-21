import { compileTaskGraph } from "../graph/compileTaskGraph.js";
import type { CompiledExecutionGraph, PlanPackageManifest } from "../types.js";

export function canShareParallelBatch(
  manifest: PlanPackageManifest,
  selected: string[],
  candidateRef: string,
  graph: CompiledExecutionGraph = compileTaskGraph(manifest)
): boolean {
  if (!graph.parallelSafeByBlockRef.get(candidateRef)) {
    return false;
  }
  const candidateTask = graph.blockTaskByRef.get(candidateRef);
  const candidateLocks = new Set(graph.locksByBlockRef.get(candidateRef) ?? []);
  return selected.every((selectedRef) => {
    const selectedTask = graph.blockTaskByRef.get(selectedRef);
    if (
      candidateTask &&
      selectedTask &&
      (graph.taskReachable(candidateTask, selectedTask) || graph.taskReachable(selectedTask, candidateTask))
    ) {
      return false;
    }
    return !(graph.locksByBlockRef.get(selectedRef) ?? []).some((lock) => candidateLocks.has(lock));
  });
}
