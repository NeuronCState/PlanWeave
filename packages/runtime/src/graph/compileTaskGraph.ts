import { access, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, relative } from "node:path";
import { PackagePathError, resolvePackagePath } from "../package/resolvePackagePath.js";
import { edgeTypes } from "../types.js";
import type {
  CompiledExecutionGraph,
  EdgeType,
  GraphContext,
  ManifestBlock,
  ManifestEdge,
  ManifestNode,
  ManifestTaskNode,
  PlanPackageManifest,
  ValidationIssue
} from "../types.js";

function issue(code: string, message: string, path?: string): ValidationIssue {
  return { code, message, path };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
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

function blockRef(taskId: string, blockId: string): string {
  return `${taskId}#${blockId}`;
}

export function parseBlockRef(ref: string): { taskId: string; blockId: string } {
  const parts = ref.split("#");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid block ref '${ref}'. Expected '<task-id>#<block-id>'.`);
  }
  return { taskId: parts[0], blockId: parts[1] };
}

function emptyGraphContext(): GraphContext {
  return {
    goals: [],
    requirements: [],
    constraints: [],
    decisions: [],
    components: [],
    conflicts: [],
    supersedes: [],
    supersededBy: []
  };
}

function addUniqueNode(nodes: ManifestNode[], node: ManifestNode): void {
  if (!nodes.some((item) => item.id === node.id)) {
    nodes.push(node);
  }
}

function edgeKey(edge: ManifestEdge): string {
  return `${edge.from}\u0000${edge.type}\u0000${edge.to}`;
}

function findCycle(adjacency: Map<string, string[]>): string[] | null {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  for (const id of adjacency.keys()) {
    if (visited.has(id)) {
      continue;
    }
    const stack: Array<{ id: string; nextIndex: number }> = [{ id, nextIndex: 0 }];
    visiting.add(id);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const next = adjacency.get(frame.id)?.[frame.nextIndex];
      if (!next) {
        visiting.delete(frame.id);
        visited.add(frame.id);
        stack.pop();
        continue;
      }
      frame.nextIndex += 1;
      if (!adjacency.has(next)) {
        continue;
      }
      if (visiting.has(next)) {
        const cycleStart = stack.findIndex((item) => item.id === next);
        return stack.slice(cycleStart).map((item) => item.id).concat(next);
      }
      if (!visited.has(next)) {
        visiting.add(next);
        stack.push({ id: next, nextIndex: 0 });
      }
    }
  }
  return null;
}

function reachable(adjacency: Map<string, string[]>, from: string, to: string): boolean {
  if (!adjacency.has(from) || !adjacency.has(to)) {
    return false;
  }
  const visited = new Set<string>();
  const stack = [...(adjacency.get(from) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || visited.has(id)) {
      continue;
    }
    if (id === to) {
      return true;
    }
    visited.add(id);
    stack.push(...(adjacency.get(id) ?? []));
  }
  return false;
}

function validateEdgeEndpointTypes(edge: ManifestEdge, from: ManifestNode, to: ManifestNode): ValidationIssue[] {
  if (edge.type === "depends_on") {
    return from.type === "task" && to.type === "task"
      ? []
      : [issue("depends_on_non_task", "depends_on edges must connect task nodes.", "edges")];
  }
  if (edge.type === "implements") {
    return from.type === "task" && (to.type === "goal" || to.type === "requirement")
      ? []
      : [issue("edge_endpoint_type_invalid", "implements edges must connect task -> goal/requirement.", "edges")];
  }
  if (edge.type === "constrained_by") {
    return from.type === "task" && to.type === "constraint"
      ? []
      : [issue("edge_endpoint_type_invalid", "constrained_by edges must connect task -> constraint.", "edges")];
  }
  if (edge.type === "touches") {
    return from.type === "task" && to.type === "component"
      ? []
      : [issue("edge_endpoint_type_invalid", "touches edges must connect task -> component.", "edges")];
  }
  if (edge.type === "conflicts_with") {
    return to.type === "risk" || to.type === "constraint" || to.type === "task"
      ? []
      : [issue("edge_endpoint_type_invalid", "conflicts_with edges must point to risk/constraint/task.", "edges")];
  }
  return [];
}

export function compileTaskGraph(manifest: PlanPackageManifest): CompiledExecutionGraph {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const nodesById = new Map<string, ManifestNode>();
  const tasksById = new Map<string, ManifestTaskNode>();
  const taskNodesInManifestOrder: string[] = [];
  const duplicateNodeIds = new Set<string>();

  for (const node of manifest.nodes) {
    if (nodesById.has(node.id)) {
      duplicateNodeIds.add(node.id);
    }
    nodesById.set(node.id, node);
    if (node.type === "task") {
      tasksById.set(node.id, node);
      taskNodesInManifestOrder.push(node.id);
    }
  }
  for (const id of duplicateNodeIds) {
    errors.push(issue("node_id_duplicate", `Node id '${id}' is duplicated.`, "nodes"));
  }

  const taskDependenciesByTask = new Map<string, string[]>();
  const taskDependentsByTask = new Map<string, string[]>();
  const contextEdgesByTask = new Map<string, ManifestEdge[]>();
  const taskAdjacency = new Map<string, string[]>();
  const blockRefsInManifestOrder: string[] = [];
  const blocksByRef = new Map<string, ManifestBlock>();
  const blockTaskByRef = new Map<string, string>();
  const blocksByTask = new Map<string, string[]>();
  const blockDependenciesByRef = new Map<string, string[]>();
  const blockDependentsByRef = new Map<string, string[]>();
  const reviewBlocksByTask = new Map<string, string[]>();
  const locksByBlockRef = new Map<string, string[]>();
  const parallelSafeByBlockRef = new Map<string, boolean>();

  for (const taskId of taskNodesInManifestOrder) {
    taskDependenciesByTask.set(taskId, []);
    taskDependentsByTask.set(taskId, []);
    contextEdgesByTask.set(taskId, []);
    taskAdjacency.set(taskId, []);
    blocksByTask.set(taskId, []);
    reviewBlocksByTask.set(taskId, []);

    const task = tasksById.get(taskId);
    const blockIds = new Set<string>();
    for (const block of task?.blocks ?? []) {
      const ref = blockRef(taskId, block.id);
      if (blockIds.has(block.id)) {
        errors.push(issue("block_id_duplicate", `Block id '${block.id}' is duplicated in task '${taskId}'.`, `nodes.${taskId}.blocks`));
      }
      blockIds.add(block.id);
      blockRefsInManifestOrder.push(ref);
      blocksByRef.set(ref, block);
      blockTaskByRef.set(ref, taskId);
      blocksByTask.get(taskId)?.push(ref);
      blockDependenciesByRef.set(ref, []);
      blockDependentsByRef.set(ref, []);
      if (block.type === "review") {
        reviewBlocksByTask.get(taskId)?.push(ref);
      }
      if (block.type === "implementation" || block.type === "check") {
        locksByBlockRef.set(ref, block.parallel.locks);
        parallelSafeByBlockRef.set(ref, block.parallel.safe);
      } else {
        locksByBlockRef.set(ref, []);
        parallelSafeByBlockRef.set(ref, false);
      }
    }
  }

  for (const taskId of taskNodesInManifestOrder) {
    const knownBlockIds = new Set((blocksByTask.get(taskId) ?? []).map((ref) => parseBlockRef(ref).blockId));
    for (const block of tasksById.get(taskId)?.blocks ?? []) {
      const ref = blockRef(taskId, block.id);
      for (const dependencyBlockId of block.depends_on) {
        if (!knownBlockIds.has(dependencyBlockId)) {
          errors.push(
            issue(
              "block_dependency_missing",
              `Block '${ref}' depends on missing block '${dependencyBlockId}' in the same task node.`,
              ref
            )
          );
          continue;
        }
        const dependencyRef = blockRef(taskId, dependencyBlockId);
        blockDependenciesByRef.get(ref)?.push(dependencyRef);
        blockDependentsByRef.get(dependencyRef)?.push(ref);
      }
    }
  }

  const edgesByType = new Map<EdgeType, ManifestEdge[]>();
  for (const type of edgeTypes) {
    edgesByType.set(type, []);
  }
  const outgoingEdgesByNode = new Map<string, ManifestEdge[]>();
  const incomingEdgesByNode = new Map<string, ManifestEdge[]>();
  for (const node of manifest.nodes) {
    outgoingEdgesByNode.set(node.id, []);
    incomingEdgesByNode.set(node.id, []);
  }
  const seenEdges = new Set<string>();
  for (const edge of manifest.edges) {
    const key = edgeKey(edge);
    if (seenEdges.has(key)) {
      errors.push(issue("edge_duplicate", `Edge '${edge.from} --${edge.type}--> ${edge.to}' is duplicated.`, "edges"));
    }
    seenEdges.add(key);
    edgesByType.get(edge.type)?.push(edge);
    const from = nodesById.get(edge.from);
    const to = nodesById.get(edge.to);
    if (!from) {
      errors.push(issue("edge_from_missing", `Edge references missing from node '${edge.from}'.`, "edges"));
    }
    if (!to) {
      errors.push(issue("edge_to_missing", `Edge references missing to node '${edge.to}'.`, "edges"));
    }
    if (!from || !to) {
      continue;
    }
    outgoingEdgesByNode.get(edge.from)?.push(edge);
    incomingEdgesByNode.get(edge.to)?.push(edge);
    const endpointIssues = validateEdgeEndpointTypes(edge, from, to);
    if (endpointIssues.length > 0) {
      errors.push(...endpointIssues);
      continue;
    }
    if (edge.type === "depends_on") {
      taskDependenciesByTask.get(edge.from)?.push(edge.to);
      taskDependentsByTask.get(edge.to)?.push(edge.from);
      taskAdjacency.get(edge.from)?.push(edge.to);
    } else {
      if (tasksById.has(edge.from)) {
        contextEdgesByTask.get(edge.from)?.push(edge);
      }
      if (tasksById.has(edge.to)) {
        contextEdgesByTask.get(edge.to)?.push(edge);
      }
    }
  }

  const taskCycle = findCycle(taskAdjacency);
  if (taskCycle) {
    errors.push(issue("depends_on_cycle", `Task dependency cycle detected: ${taskCycle.join(" -> ")}.`, "edges"));
  }
  const blockCycle = findCycle(blockDependenciesByRef);
  if (blockCycle) {
    errors.push(issue("block_depends_on_cycle", `Block dependency cycle detected: ${blockCycle.join(" -> ")}.`, "blocks"));
  }

  for (const taskId of taskNodesInManifestOrder) {
    const blocks = blocksByTask.get(taskId) ?? [];
    if (!blocks.some((ref) => blocksByRef.get(ref)?.type === "implementation")) {
      errors.push(issue("task_without_implementation_block", `Task '${taskId}' must contain an implementation block.`, taskId));
    }
    if (!blocks.some((ref) => blocksByRef.get(ref)?.type === "review")) {
      errors.push(issue("task_without_review_block", `Task '${taskId}' must contain a review block.`, taskId));
    }
  }

  function relatedContext(taskId: string): GraphContext {
    const context = emptyGraphContext();
    for (const edge of contextEdgesByTask.get(taskId) ?? []) {
      const otherId = edge.from === taskId ? edge.to : edge.from;
      const other = nodesById.get(otherId);
      if (!other) {
        continue;
      }
      if (edge.type === "conflicts_with") {
        addUniqueNode(context.conflicts, other);
      } else if (edge.type === "supersedes") {
        addUniqueNode(edge.from === taskId ? context.supersedes : context.supersededBy, other);
      } else if (edge.type === "constrained_by" || other.type === "constraint") {
        addUniqueNode(context.constraints, other);
      } else if (edge.type === "touches" || other.type === "component") {
        addUniqueNode(context.components, other);
      } else if (other.type === "goal") {
        addUniqueNode(context.goals, other);
      } else if (other.type === "requirement") {
        addUniqueNode(context.requirements, other);
      } else if (other.type === "decision") {
        addUniqueNode(context.decisions, other);
      }
    }
    return context;
  }

  return {
    nodesById,
    taskNodesInManifestOrder,
    tasksById,
    taskDependenciesByTask,
    taskDependentsByTask,
    contextEdgesByTask,
    blockRefsInManifestOrder,
    blocksByRef,
    blockTaskByRef,
    blocksByTask,
    blockDependenciesByRef,
    blockDependentsByRef,
    reviewBlocksByTask,
    locksByBlockRef,
    parallelSafeByBlockRef,
    diagnostics: { errors, warnings },
    taskReachable: (from, to) => reachable(taskAdjacency, from, to),
    blockReachable: (fromRef, toRef) => reachable(blockDependenciesByRef, fromRef, toRef),
    relatedContext
  };
}

async function validatePromptReference(packageDir: string, prompt: string, errors: ValidationIssue[]): Promise<void> {
  try {
    const promptPath = await resolvePackagePath(packageDir, prompt);
    if (!(await exists(promptPath))) {
      errors.push(issue("prompt_missing", `Prompt file '${prompt}' does not exist.`, prompt));
    }
  } catch (error) {
    if (error instanceof PackagePathError) {
      errors.push(issue(error.code, error.message, prompt));
    } else {
      throw error;
    }
  }
}

export async function compilePackageGraph(manifest: PlanPackageManifest, packageDir: string): Promise<CompiledExecutionGraph> {
  const graph = compileTaskGraph(manifest);
  const referencedPrompts = new Set<string>();

  for (const taskId of graph.taskNodesInManifestOrder) {
    const task = graph.tasksById.get(taskId);
    if (!task) {
      continue;
    }
    referencedPrompts.add(task.prompt);
    await validatePromptReference(packageDir, task.prompt, graph.diagnostics.errors);
    for (const block of task.blocks) {
      referencedPrompts.add(block.prompt);
      await validatePromptReference(packageDir, block.prompt, graph.diagnostics.errors);
    }
  }

  for (const file of await listMarkdownFiles(join(packageDir, "nodes"))) {
    const promptPath = relative(packageDir, file);
    if (!referencedPrompts.has(promptPath)) {
      graph.diagnostics.warnings.push(issue("stale_prompt_reference", `Prompt '${promptPath}' is not referenced.`, promptPath));
      continue;
    }
    try {
      await readFile(file, "utf8");
    } catch {
      graph.diagnostics.errors.push(issue("prompt_read_failed", `Prompt '${promptPath}' could not be read.`, promptPath));
    }
  }

  return graph;
}
