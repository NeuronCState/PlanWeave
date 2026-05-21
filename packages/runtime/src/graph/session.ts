import { isAbsolute, join, relative } from "node:path";
import { compilePackageGraph } from "./compileTaskGraph.js";
import { loadPackage } from "../package/loadPackage.js";
import { readJsonFile } from "../json.js";
import { createPackageFileSnapshot } from "../package/fileChanges.js";
import type {
  CompiledExecutionGraph,
  DrainGraphReadQueueResult,
  ExecutionGraphSession,
  GraphEditOperation,
  ManifestBlock,
  ManifestEdge,
  ManifestNode,
  ManifestTaskNode,
  PackageFileChange,
  PlanPackageManifest,
  ValidationIssue
} from "../types.js";

function issue(code: string, message: string, path?: string): ValidationIssue {
  return { code, message, path };
}

async function readManifest(packageRoot: string): Promise<PlanPackageManifest> {
  return readJsonFile<PlanPackageManifest>(join(packageRoot, "manifest.json"));
}

function promptPathToRefs(graph: CompiledExecutionGraph, path: string): string[] {
  const refs: string[] = [];
  for (const taskId of graph.taskNodesInManifestOrder) {
    const task = graph.tasksById.get(taskId);
    if (!task) {
      continue;
    }
    if (task.prompt === path) {
      refs.push(...(graph.blocksByTask.get(taskId) ?? []));
    }
    for (const block of task.blocks) {
      if (block.prompt === path) {
        refs.push(`${taskId}#${block.id}`);
      }
    }
  }
  return refs;
}

function dedupeFileChanges(changes: PackageFileChange[]): PackageFileChange[] {
  return [...new Map(changes.map((change) => [change.path, change])).values()];
}

function blockRef(taskId: string, blockId: string): string {
  return `${taskId}#${blockId}`;
}

function reachable(adjacency: Map<string, string[]>, from: string, to: string): boolean {
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

function refreshReachability(graph: CompiledExecutionGraph): void {
  graph.taskReachable = (from, to) => reachable(graph.taskDependenciesByTask, from, to);
  graph.blockReachable = (fromRef, toRef) => reachable(graph.blockDependenciesByRef, fromRef, toRef);
}

function addBlockIndexes(graph: CompiledExecutionGraph, taskId: string, block: ManifestBlock): void {
  const ref = blockRef(taskId, block.id);
  graph.blockRefsInManifestOrder.push(ref);
  graph.blocksByRef.set(ref, block);
  graph.blockTaskByRef.set(ref, taskId);
  graph.blocksByTask.get(taskId)?.push(ref);
  graph.blockDependenciesByRef.set(ref, block.depends_on.map((dependencyId) => blockRef(taskId, dependencyId)));
  graph.blockDependentsByRef.set(ref, []);
  for (const dependencyRef of graph.blockDependenciesByRef.get(ref) ?? []) {
    graph.blockDependentsByRef.get(dependencyRef)?.push(ref);
  }
  if (block.type === "review") {
    graph.reviewBlocksByTask.get(taskId)?.push(ref);
    graph.locksByBlockRef.set(ref, []);
    graph.parallelSafeByBlockRef.set(ref, false);
  } else {
    graph.locksByBlockRef.set(ref, block.parallel.locks);
    graph.parallelSafeByBlockRef.set(ref, block.parallel.safe);
  }
}

function removeTaskIndexes(graph: CompiledExecutionGraph, taskId: string): string[] {
  const removedRefs = graph.blocksByTask.get(taskId) ?? [];
  for (const ref of removedRefs) {
    graph.blocksByRef.delete(ref);
    graph.blockTaskByRef.delete(ref);
    graph.blockDependenciesByRef.delete(ref);
    graph.blockDependentsByRef.delete(ref);
    graph.locksByBlockRef.delete(ref);
    graph.parallelSafeByBlockRef.delete(ref);
  }
  for (const dependents of graph.blockDependentsByRef.values()) {
    for (let index = dependents.length - 1; index >= 0; index -= 1) {
      if (removedRefs.includes(dependents[index])) {
        dependents.splice(index, 1);
      }
    }
  }
  graph.blockRefsInManifestOrder.splice(0, graph.blockRefsInManifestOrder.length, ...graph.blockRefsInManifestOrder.filter((ref) => !removedRefs.includes(ref)));
  graph.nodesById.delete(taskId);
  graph.tasksById.delete(taskId);
  graph.taskNodesInManifestOrder.splice(
    0,
    graph.taskNodesInManifestOrder.length,
    ...graph.taskNodesInManifestOrder.filter((id) => id !== taskId)
  );
  graph.taskDependenciesByTask.delete(taskId);
  graph.taskDependentsByTask.delete(taskId);
  graph.contextEdgesByTask.delete(taskId);
  graph.blocksByTask.delete(taskId);
  graph.reviewBlocksByTask.delete(taskId);
  return removedRefs;
}

function addTaskIndexes(graph: CompiledExecutionGraph, task: ManifestTaskNode): void {
  graph.nodesById.set(task.id, task);
  graph.tasksById.set(task.id, task);
  if (!graph.taskNodesInManifestOrder.includes(task.id)) {
    graph.taskNodesInManifestOrder.push(task.id);
  }
  graph.taskDependenciesByTask.set(task.id, graph.taskDependenciesByTask.get(task.id) ?? []);
  graph.taskDependentsByTask.set(task.id, graph.taskDependentsByTask.get(task.id) ?? []);
  graph.contextEdgesByTask.set(task.id, graph.contextEdgesByTask.get(task.id) ?? []);
  graph.blocksByTask.set(task.id, []);
  graph.reviewBlocksByTask.set(task.id, []);
  for (const block of task.blocks) {
    addBlockIndexes(graph, task.id, block);
  }
}

function validateTaskBlocks(task: ManifestTaskNode): ValidationIssue[] {
  const diagnostics: ValidationIssue[] = [];
  const blockIds = new Set<string>();
  const adjacency = new Map<string, string[]>();
  for (const block of task.blocks) {
    if (blockIds.has(block.id)) {
      diagnostics.push(issue("block_id_duplicate", `Block id '${block.id}' is duplicated in task '${task.id}'.`, `nodes.${task.id}.blocks`));
    }
    blockIds.add(block.id);
    adjacency.set(block.id, []);
  }
  for (const block of task.blocks) {
    for (const dependencyId of block.depends_on) {
      if (!blockIds.has(dependencyId)) {
        diagnostics.push(
          issue("block_dependency_missing", `Block '${task.id}#${block.id}' depends on missing block '${dependencyId}' in the same task node.`, blockRef(task.id, block.id))
        );
        continue;
      }
      if (dependencyId === block.id || reachable(adjacency, dependencyId, block.id)) {
        diagnostics.push(issue("block_depends_on_cycle", `Block dependency cycle detected in task '${task.id}'.`, `nodes.${task.id}.blocks`));
        continue;
      }
      adjacency.get(block.id)?.push(dependencyId);
    }
  }
  return diagnostics;
}

function sameEdge(left: ManifestEdge, right: ManifestEdge): boolean {
  return left.from === right.from && left.to === right.to && left.type === right.type;
}

function edgeKey(edge: ManifestEdge): string {
  return `${edge.from}\u0000${edge.type}\u0000${edge.to}`;
}

function nodeKey(node: ManifestNode): string {
  return JSON.stringify(node);
}

function diffManifestToGraphOps(before: PlanPackageManifest, after: PlanPackageManifest): GraphEditOperation[] {
  const operations: GraphEditOperation[] = [];
  const beforeNodes = new Map(before.nodes.map((node) => [node.id, node]));
  const afterNodes = new Map(after.nodes.map((node) => [node.id, node]));

  for (const node of before.nodes) {
    if (!afterNodes.has(node.id)) {
      operations.push({ type: "remove_node", nodeId: node.id });
    }
  }
  for (const node of after.nodes) {
    const previous = beforeNodes.get(node.id);
    if (!previous) {
      operations.push({ type: "add_node", node });
    } else if (nodeKey(previous) !== nodeKey(node)) {
      operations.push({ type: "update_node", node });
    }
  }

  const beforeEdges = new Map(before.edges.map((edge) => [edgeKey(edge), edge]));
  const afterEdges = new Map(after.edges.map((edge) => [edgeKey(edge), edge]));
  for (const edge of before.edges) {
    if (!afterEdges.has(edgeKey(edge))) {
      operations.push({ type: "remove_edge", edge });
    }
  }
  for (const edge of after.edges) {
    if (!beforeEdges.has(edgeKey(edge))) {
      operations.push({ type: "add_edge", edge });
    }
  }
  return operations;
}

function alignGraphOrder(graph: CompiledExecutionGraph, manifest: PlanPackageManifest): void {
  graph.taskNodesInManifestOrder.splice(
    0,
    graph.taskNodesInManifestOrder.length,
    ...manifest.nodes.filter((node): node is ManifestTaskNode => node.type === "task").map((node) => node.id)
  );
  graph.blockRefsInManifestOrder.splice(
    0,
    graph.blockRefsInManifestOrder.length,
    ...manifest.nodes
      .filter((node): node is ManifestTaskNode => node.type === "task")
      .flatMap((node) => node.blocks.map((block) => blockRef(node.id, block.id)))
  );
}

function removeDirtyRefs(session: ExecutionGraphSession, refs: string[]): void {
  for (const ref of refs) {
    session.dirtyPromptRefs.delete(ref);
  }
}

function validateEdge(graph: CompiledExecutionGraph, edge: ManifestEdge): ValidationIssue[] {
  const from = graph.nodesById.get(edge.from);
  const to = graph.nodesById.get(edge.to);
  if (!from) {
    return [issue("edge_from_missing", `Edge references missing from node '${edge.from}'.`, "edges")];
  }
  if (!to) {
    return [issue("edge_to_missing", `Edge references missing to node '${edge.to}'.`, "edges")];
  }
  if (edge.type === "depends_on" && (from.type !== "task" || to.type !== "task")) {
    return [issue("depends_on_non_task", "depends_on edges must connect task nodes.", "edges")];
  }
  if (edge.type === "depends_on" && (edge.from === edge.to || graph.taskReachable(edge.to, edge.from))) {
    return [issue("depends_on_cycle", `Task dependency cycle detected by edge '${edge.from}' -> '${edge.to}'.`, "edges")];
  }
  return [];
}

function addEdgeIndexes(graph: CompiledExecutionGraph, edge: ManifestEdge): void {
  if (edge.type === "depends_on") {
    graph.taskDependenciesByTask.get(edge.from)?.push(edge.to);
    graph.taskDependentsByTask.get(edge.to)?.push(edge.from);
  } else {
    if (graph.tasksById.has(edge.from)) {
      graph.contextEdgesByTask.get(edge.from)?.push(edge);
    }
    if (graph.tasksById.has(edge.to)) {
      graph.contextEdgesByTask.get(edge.to)?.push(edge);
    }
  }
}

function removeEdgeIndexes(graph: CompiledExecutionGraph, edge: ManifestEdge): void {
  const remove = (items: string[] | undefined, value: string) => {
    if (!items) {
      return;
    }
    const index = items.indexOf(value);
    if (index >= 0) {
      items.splice(index, 1);
    }
  };
  if (edge.type === "depends_on") {
    remove(graph.taskDependenciesByTask.get(edge.from), edge.to);
    remove(graph.taskDependentsByTask.get(edge.to), edge.from);
  } else {
    for (const edges of graph.contextEdgesByTask.values()) {
      const index = edges.findIndex((item) => sameEdge(item, edge));
      if (index >= 0) {
        edges.splice(index, 1);
      }
    }
  }
}

function rebuildEdgeIndexes(graph: CompiledExecutionGraph, manifest: PlanPackageManifest): void {
  for (const taskId of graph.taskNodesInManifestOrder) {
    graph.taskDependenciesByTask.set(taskId, []);
    graph.taskDependentsByTask.set(taskId, []);
    graph.contextEdgesByTask.set(taskId, []);
  }
  for (const edge of manifest.edges) {
    if (graph.nodesById.has(edge.from) && graph.nodesById.has(edge.to)) {
      addEdgeIndexes(graph, edge);
    }
  }
}

function applyGraphEditOperation(session: ExecutionGraphSession, operation: GraphEditOperation): ValidationIssue[] {
  const graph = session.graph;
  const manifest = session.fileSnapshot.manifest;
  if (operation.type === "update_prompt") {
    const taskId = graph.blockTaskByRef.get(operation.ref);
    if (!taskId) {
      return [issue("block_missing", `Block '${operation.ref}' does not exist.`, operation.ref)];
    }
    session.dirtyPromptRefs.add(operation.ref);
    return [];
  }
  if (operation.type === "add_node") {
    if (graph.nodesById.has(operation.node.id)) {
      return [issue("node_id_duplicate", `Node '${operation.node.id}' already exists.`, "nodes")];
    }
    if (operation.node.type === "task") {
      const diagnostics = validateTaskBlocks(operation.node);
      if (diagnostics.length > 0) {
        return diagnostics;
      }
    }
    manifest.nodes.push(operation.node);
    graph.nodesById.set(operation.node.id, operation.node);
    if (operation.node.type === "task") {
      addTaskIndexes(graph, operation.node);
      for (const ref of graph.blocksByTask.get(operation.node.id) ?? []) {
        session.dirtyPromptRefs.add(ref);
      }
    }
    return [];
  }
  if (operation.type === "update_node") {
    const index = manifest.nodes.findIndex((node) => node.id === operation.node.id);
    if (index < 0) {
      return [issue("node_missing", `Node '${operation.node.id}' does not exist.`, "nodes")];
    }
    if (operation.node.type === "task") {
      const diagnostics = validateTaskBlocks(operation.node);
      if (diagnostics.length > 0) {
        return diagnostics;
      }
    }
    const previous = manifest.nodes[index];
    let removedRefs: string[] = [];
    if (previous.type === "task") {
      removedRefs = removeTaskIndexes(graph, previous.id);
    }
    manifest.nodes[index] = operation.node;
    graph.nodesById.set(operation.node.id, operation.node);
    if (operation.node.type === "task") {
      removeDirtyRefs(session, removedRefs);
      addTaskIndexes(graph, operation.node);
      alignGraphOrder(graph, manifest);
      for (const ref of graph.blocksByTask.get(operation.node.id) ?? []) {
        session.dirtyPromptRefs.add(ref);
      }
    }
    return [];
  }
  if (operation.type === "remove_node") {
    const node = graph.nodesById.get(operation.nodeId);
    if (!node) {
      return [issue("node_missing", `Node '${operation.nodeId}' does not exist.`, "nodes")];
    }
    const removedEdges = manifest.edges.filter((edge) => edge.from === operation.nodeId || edge.to === operation.nodeId);
    manifest.edges = manifest.edges.filter((edge) => edge.from !== operation.nodeId && edge.to !== operation.nodeId);
    for (const edge of removedEdges) {
      removeEdgeIndexes(graph, edge);
    }
    manifest.nodes = manifest.nodes.filter((item) => item.id !== operation.nodeId);
    if (node.type === "task") {
      removeDirtyRefs(session, removeTaskIndexes(graph, node.id));
    } else {
      graph.nodesById.delete(node.id);
    }
    return [];
  }
  if (operation.type === "add_edge") {
    if (manifest.edges.some((edge) => sameEdge(edge, operation.edge))) {
      return [issue("edge_duplicate", "Edge already exists.", "edges")];
    }
    const diagnostics = validateEdge(graph, operation.edge);
    if (diagnostics.length > 0) {
      return diagnostics;
    }
    manifest.edges.push(operation.edge);
    addEdgeIndexes(graph, operation.edge);
    return [];
  }
  if (operation.type === "remove_edge") {
    const index = manifest.edges.findIndex((edge) => sameEdge(edge, operation.edge));
    if (index >= 0) {
      manifest.edges.splice(index, 1);
      removeEdgeIndexes(graph, operation.edge);
    }
  }
  return [];
}

async function rebuildGraph(packageRoot: string): Promise<{ graph: CompiledExecutionGraph; diagnostics: ValidationIssue[] }> {
  const manifest = await readManifest(packageRoot);
  const graph = await compilePackageGraph(manifest, packageRoot);
  return { graph, diagnostics: [...graph.diagnostics.errors, ...graph.diagnostics.warnings] };
}

async function rebuildSessionFromPackage(session: ExecutionGraphSession): Promise<void> {
  const rebuilt = await rebuildGraph(session.packageRoot);
  session.graph = rebuilt.graph;
  session.fileSnapshot = await createPackageFileSnapshot(session.projectRoot);
  session.diagnostics = rebuilt.diagnostics;
  session.dirtyPromptRefs = new Set(session.graph.blockRefsInManifestOrder);
}

export async function createExecutionGraphSession(projectRoot: string): Promise<ExecutionGraphSession> {
  const { workspace, manifest } = await loadPackage(projectRoot);
  const graph = await compilePackageGraph(manifest, workspace.packageDir);
  return {
    projectRoot,
    projectId: workspace.id,
    packageRoot: workspace.packageDir,
    graph,
    fileSnapshot: await createPackageFileSnapshot(projectRoot),
    readQueue: {
      fileChanges: [],
      graphOps: [],
      enqueuedAt: new Date().toISOString()
    },
    dirtyPromptRefs: new Set(),
    diagnostics: [...graph.diagnostics.errors, ...graph.diagnostics.warnings]
  };
}

export function enqueuePackageFileChanges(session: ExecutionGraphSession, changes: PackageFileChange[]): void {
  session.readQueue.fileChanges.push(...changes);
  session.readQueue.enqueuedAt = new Date().toISOString();
}

export function enqueueGraphEditOperations(session: ExecutionGraphSession, operations: GraphEditOperation[]): void {
  session.readQueue.graphOps.push(...operations);
  session.readQueue.enqueuedAt = new Date().toISOString();
}

function normalizePackagePath(session: ExecutionGraphSession, path: string): string {
  return isAbsolute(path) ? relative(session.packageRoot, path) : path;
}

export async function drainGraphReadQueue(session: ExecutionGraphSession): Promise<DrainGraphReadQueueResult> {
  const fileChanges = dedupeFileChanges(session.readQueue.fileChanges);
  const graphOps = session.readQueue.graphOps;
  session.readQueue = {
    fileChanges: [],
    graphOps: [],
    enqueuedAt: new Date().toISOString()
  };

  if (graphOps.length > 0) {
    const diagnostics: ValidationIssue[] = [];
    for (const operation of graphOps) {
      diagnostics.push(...applyGraphEditOperation(session, operation));
      rebuildEdgeIndexes(session.graph, session.fileSnapshot.manifest);
      refreshReachability(session.graph);
    }
    if (diagnostics.length > 0) {
      await rebuildSessionFromPackage(session);
      session.diagnostics = diagnostics;
      return {
        session,
        refreshed: true,
        dirtyPromptRefs: [...session.dirtyPromptRefs],
        diagnostics: session.diagnostics
      };
    }
    session.fileSnapshot.graph = session.graph;
    session.diagnostics = diagnostics;
    return {
      session,
      refreshed: session.dirtyPromptRefs.size > 0 || diagnostics.length > 0,
      dirtyPromptRefs: [...session.dirtyPromptRefs],
      diagnostics: session.diagnostics
    };
  }

  const normalizedChanges = fileChanges.map((change) => ({ ...change, path: normalizePackagePath(session, change.path) }));
  const manifestChanged = normalizedChanges.some((change) => change.path === "manifest.json" || change.path.endsWith("/manifest.json"));
  if (manifestChanged) {
    const nextManifest = await readManifest(session.packageRoot);
    const operations = diffManifestToGraphOps(session.fileSnapshot.manifest, nextManifest);
    const diagnostics: ValidationIssue[] = [];
    for (const operation of operations) {
      diagnostics.push(...applyGraphEditOperation(session, operation));
      rebuildEdgeIndexes(session.graph, session.fileSnapshot.manifest);
      refreshReachability(session.graph);
    }
    if (diagnostics.length > 0) {
      await rebuildSessionFromPackage(session);
      session.diagnostics = diagnostics;
      return {
        session,
        refreshed: true,
        dirtyPromptRefs: [...session.dirtyPromptRefs],
        diagnostics: session.diagnostics
      };
    }
    session.fileSnapshot.manifest = nextManifest;
    session.fileSnapshot.graph = session.graph;
    alignGraphOrder(session.graph, nextManifest);
    rebuildEdgeIndexes(session.graph, nextManifest);
    refreshReachability(session.graph);
    session.diagnostics = [...session.graph.diagnostics.errors, ...session.graph.diagnostics.warnings];
    return {
      session,
      refreshed: session.dirtyPromptRefs.size > 0 || operations.length > 0,
      dirtyPromptRefs: [...session.dirtyPromptRefs],
      diagnostics: session.diagnostics
    };
  }

  for (const change of normalizedChanges) {
    for (const ref of promptPathToRefs(session.graph, change.path)) {
      session.dirtyPromptRefs.add(ref);
    }
  }
  if (normalizedChanges.length > 0) {
    session.fileSnapshot = await createPackageFileSnapshot(session.projectRoot);
  }
  return {
    session,
    refreshed: session.dirtyPromptRefs.size > 0,
    dirtyPromptRefs: [...session.dirtyPromptRefs],
    diagnostics: session.diagnostics
  };
}
