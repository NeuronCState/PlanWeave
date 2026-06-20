import {
  compileProjectGraph,
  loadProjectGraph,
  projectCanvasEdgeKey,
  projectCrossTaskEdgeKey,
  writeProjectGraph,
  type ProjectCanvasEdge,
  type ProjectCrossTaskEdge,
  type ProjectGraphManifest,
  type ProjectTaskRef
} from "../projectGraph/index.js";
import type { ValidationIssue } from "../types.js";

export type ProjectGraphEditResult = {
  ok: boolean;
  diagnostics: ValidationIssue[];
  graph: ProjectGraphManifest;
};

function result(graph: ProjectGraphManifest, diagnostics: ValidationIssue[] = []): ProjectGraphEditResult {
  return {
    ok: diagnostics.length === 0,
    diagnostics,
    graph
  };
}

async function commitProjectGraphEdit(projectRoot: string, graph: ProjectGraphManifest): Promise<ProjectGraphEditResult> {
  const loaded = await loadProjectGraph(projectRoot);
  const compiled = await compileProjectGraph({
    workspace: loaded.workspace,
    manifest: graph,
    source: "project_graph",
    diagnostics: []
  });
  if (compiled.diagnostics.errors.length > 0) {
    return result(graph, compiled.diagnostics.errors);
  }
  await writeProjectGraph(loaded.workspace, graph);
  return result(graph, compiled.diagnostics.warnings);
}

function canvasEdge(fromCanvasId: string, toCanvasId: string): ProjectCanvasEdge {
  return { from: fromCanvasId, to: toCanvasId, type: "depends_on" };
}

function crossTaskEdge(from: ProjectTaskRef, to: ProjectTaskRef): ProjectCrossTaskEdge {
  return { from, to, type: "depends_on" };
}

export async function addCanvasDependency(projectRoot: string, fromCanvasId: string, toCanvasId: string): Promise<ProjectGraphEditResult> {
  const loaded = await loadProjectGraph(projectRoot);
  const edge = canvasEdge(fromCanvasId, toCanvasId);
  const key = projectCanvasEdgeKey(edge);
  const graph = loaded.manifest.edges.some((candidate) => projectCanvasEdgeKey(candidate) === key)
    ? loaded.manifest
    : { ...loaded.manifest, edges: [...loaded.manifest.edges, edge] };
  return commitProjectGraphEdit(projectRoot, graph);
}

export async function removeCanvasDependency(projectRoot: string, fromCanvasId: string, toCanvasId: string): Promise<ProjectGraphEditResult> {
  const loaded = await loadProjectGraph(projectRoot);
  const edge = canvasEdge(fromCanvasId, toCanvasId);
  const key = projectCanvasEdgeKey(edge);
  return commitProjectGraphEdit(projectRoot, {
    ...loaded.manifest,
    edges: loaded.manifest.edges.filter((candidate) => projectCanvasEdgeKey(candidate) !== key)
  });
}

export async function addCrossTaskDependency(projectRoot: string, from: ProjectTaskRef, to: ProjectTaskRef): Promise<ProjectGraphEditResult> {
  const loaded = await loadProjectGraph(projectRoot);
  const edge = crossTaskEdge(from, to);
  const key = projectCrossTaskEdgeKey(edge);
  const graph = loaded.manifest.crossTaskEdges.some((candidate) => projectCrossTaskEdgeKey(candidate) === key)
    ? loaded.manifest
    : { ...loaded.manifest, crossTaskEdges: [...loaded.manifest.crossTaskEdges, edge] };
  return commitProjectGraphEdit(projectRoot, graph);
}

export async function removeCrossTaskDependency(projectRoot: string, from: ProjectTaskRef, to: ProjectTaskRef): Promise<ProjectGraphEditResult> {
  const loaded = await loadProjectGraph(projectRoot);
  const edge = crossTaskEdge(from, to);
  const key = projectCrossTaskEdgeKey(edge);
  return commitProjectGraphEdit(projectRoot, {
    ...loaded.manifest,
    crossTaskEdges: loaded.manifest.crossTaskEdges.filter((candidate) => projectCrossTaskEdgeKey(candidate) !== key)
  });
}
