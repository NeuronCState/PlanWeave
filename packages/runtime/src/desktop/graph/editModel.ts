import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseBlockRef } from "../../graph/compileTaskGraph.js";
import { compileTaskGraph } from "../../graph/compileTaskGraph.js";
import { addEdge, addNode, removeEdge, removeNode, updateNode } from "../../graph/editGraph.js";
import { loadPackage } from "../../package/loadPackage.js";
import { resolvePackagePath } from "../../package/resolvePackagePath.js";
import type { BlockType, GraphEditResult, ManifestBlock, ManifestTaskNode, NodeType, PlanPackageManifest } from "../../types.js";
import type { DesktopAddBlockInput, DesktopAddContextNodeInput, DesktopAddTaskInput, DesktopGraphEditValidationInput } from "../types.js";
import { getBlock, getTask } from "./graphHelpers.js";

function normalizeOptionalText(value: string | null): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireNonEmptyTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new Error("Title must not be empty.");
  }
  return trimmed;
}

function slugPart(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18);
}

function nextTaskId(manifest: PlanPackageManifest, title: string): string {
  const existing = new Set(manifest.nodes.map((node) => node.id));
  const base = slugPart(title);
  if (base && !existing.has(`T-${base}`)) {
    return `T-${base}`;
  }
  let index = manifest.nodes.filter((node) => node.type === "task").length + 1;
  while (existing.has(`T-${String(index).padStart(3, "0")}`)) {
    index += 1;
  }
  return `T-${String(index).padStart(3, "0")}`;
}

function contextPrefix(type: Exclude<NodeType, "task">): string {
  if (type === "requirement") {
    return "REQ";
  }
  if (type === "constraint") {
    return "CON";
  }
  if (type === "decision") {
    return "DEC";
  }
  if (type === "component") {
    return "CMP";
  }
  if (type === "risk") {
    return "RSK";
  }
  return "G";
}

function nextContextId(manifest: PlanPackageManifest, type: Exclude<NodeType, "task">, title: string): string {
  const existing = new Set(manifest.nodes.map((node) => node.id));
  const prefix = contextPrefix(type);
  const base = slugPart(title);
  if (base && !existing.has(`${prefix}-${base}`)) {
    return `${prefix}-${base}`;
  }
  let index = manifest.nodes.filter((node) => node.type === type).length + 1;
  while (existing.has(`${prefix}-${String(index).padStart(3, "0")}`)) {
    index += 1;
  }
  return `${prefix}-${String(index).padStart(3, "0")}`;
}

function blockPrefix(type: BlockType): string {
  if (type === "check") {
    return "C";
  }
  if (type === "review") {
    return "R";
  }
  return "B";
}

function nextBlockId(task: ManifestTaskNode, type: BlockType): string {
  const prefix = blockPrefix(type);
  const existing = new Set(task.blocks.map((block) => block.id));
  let index = task.blocks.filter((block) => block.id.startsWith(`${prefix}-`)).length + 1;
  while (existing.has(`${prefix}-${String(index).padStart(3, "0")}`)) {
    index += 1;
  }
  return `${prefix}-${String(index).padStart(3, "0")}`;
}

function defaultBlockTitle(type: BlockType): string {
  if (type === "check") {
    return "Check work";
  }
  if (type === "review") {
    return "Review work";
  }
  return "Implement work";
}

function createBlock(options: {
  taskId: string;
  blockId: string;
  type: BlockType;
  title: string;
  dependsOn: string[];
  executor?: string;
  maxFeedbackCycles: number;
}): ManifestBlock {
  const common = {
    id: options.blockId,
    type: options.type,
    title: requireNonEmptyTitle(options.title),
    prompt: `nodes/${options.taskId}/blocks/${options.blockId}.prompt.md`,
    depends_on: options.dependsOn,
    executor: options.executor
  };
  if (options.type === "review") {
    return {
      ...common,
      type: "review",
      review: {
        required: true,
        maxFeedbackCycles: options.maxFeedbackCycles,
        hook: null
      }
    };
  }
  return {
    ...common,
    type: options.type,
    parallel: {
      safe: false,
      locks: []
    }
  };
}

function graphEditResult(manifest: PlanPackageManifest, affectedTasks: string[] = []): GraphEditResult {
  const graph = compileTaskGraph(manifest);
  return {
    ok: graph.diagnostics.errors.length === 0,
    affectedTasks: [...new Set(affectedTasks)],
    diagnostics: graph.diagnostics.errors,
    graph
  };
}

async function writePromptFile(packageDir: string, packagePath: string, markdown: string): Promise<void> {
  const promptPath = await resolvePackagePath(packageDir, packagePath, { forWrite: true });
  await mkdir(dirname(promptPath), { recursive: true });
  await writeFile(promptPath, markdown.endsWith("\n") ? markdown : `${markdown}\n`, "utf8");
}

export async function addTaskNode(projectRoot: string, input: DesktopAddTaskInput): Promise<GraphEditResult> {
  const { workspace, manifest } = await loadPackage(projectRoot);
  const title = requireNonEmptyTitle(input.title);
  const taskId = nextTaskId(manifest, title);
  const blockTypes = input.blockTypes?.length ? input.blockTypes : (["implementation", "check", "review"] satisfies BlockType[]);
  const blocks: ManifestBlock[] = [];
  for (const type of blockTypes) {
    const blockId = nextBlockId({ id: taskId, type: "task", title, prompt: "", acceptance: [], blocks }, type);
    blocks.push(
      createBlock({
        taskId,
        blockId,
        type,
        title: defaultBlockTitle(type),
        dependsOn: blocks.length > 0 ? [blocks[blocks.length - 1].id] : [],
        maxFeedbackCycles: manifest.review.maxFeedbackCycles
      })
    );
  }
  const node: ManifestTaskNode = {
    id: taskId,
    type: "task",
    title,
    prompt: `nodes/${taskId}/prompt.md`,
    executor: normalizeOptionalText(input.executor ?? null),
    acceptance: input.acceptance?.length ? input.acceptance : ["Task is implemented and reviewed."],
    blocks
  };
  const result = await addNode({ projectRoot, node, promptMarkdown: input.promptMarkdown });
  if (!result.ok) {
    return result;
  }
  for (const block of blocks) {
    await writePromptFile(workspace.packageDir, block.prompt, `# ${block.title}\n\n${input.promptMarkdown}`);
  }
  return result;
}

export async function addBlock(projectRoot: string, input: DesktopAddBlockInput): Promise<GraphEditResult> {
  const { workspace, manifest } = await loadPackage(projectRoot);
  const graph = compileTaskGraph(manifest);
  const task = getTask(graph, input.taskId);
  const blockId = nextBlockId(task, input.type);
  const block = createBlock({
    taskId: task.id,
    blockId,
    type: input.type,
    title: input.title,
    dependsOn: input.dependsOn ?? (task.blocks.length > 0 ? [task.blocks[task.blocks.length - 1].id] : []),
    executor: normalizeOptionalText(input.executor ?? null),
    maxFeedbackCycles: manifest.review.maxFeedbackCycles
  });
  const nextTask: ManifestTaskNode = { ...task, blocks: [...task.blocks, block] };
  const result = await updateNode({ projectRoot, node: nextTask });
  if (!result.ok) {
    return result;
  }
  await writePromptFile(workspace.packageDir, block.prompt, input.promptMarkdown);
  return result;
}

export async function addContextNode(projectRoot: string, input: DesktopAddContextNodeInput): Promise<GraphEditResult> {
  const { manifest } = await loadPackage(projectRoot);
  const title = requireNonEmptyTitle(input.title);
  return addNode({
    projectRoot,
    node: {
      id: nextContextId(manifest, input.type, title),
      type: input.type,
      title,
      summary: input.summary.trim() || `${title}.`
    }
  });
}

export async function removeTaskNode(projectRoot: string, taskId: string): Promise<GraphEditResult> {
  const { workspace, manifest } = await loadPackage(projectRoot);
  const task = getTask(compileTaskGraph(manifest), taskId);
  const result = await removeNode({ projectRoot, nodeId: taskId, removePrompt: false });
  if (!result.ok) {
    return result;
  }
  await rm(dirname(await resolvePackagePath(workspace.packageDir, task.prompt)), { recursive: true, force: true });
  return result;
}

export async function removeBlock(projectRoot: string, ref: string): Promise<GraphEditResult> {
  const { workspace, manifest } = await loadPackage(projectRoot);
  const graph = compileTaskGraph(manifest);
  const { taskId, blockId } = parseBlockRef(ref);
  const task = getTask(graph, taskId);
  const block = getBlock(graph, ref);
  const nextTask: ManifestTaskNode = {
    ...task,
    blocks: task.blocks
      .filter((candidate) => candidate.id !== blockId)
      .map((candidate) => ({
        ...candidate,
        depends_on: candidate.depends_on.filter((dependency) => dependency !== blockId)
      }))
  };
  const result = await updateNode({ projectRoot, node: nextTask });
  if (!result.ok) {
    return result;
  }
  await rm(await resolvePackagePath(workspace.packageDir, block.prompt), { force: true });
  return result;
}

export async function validateGraphEdit(projectRoot: string, input: DesktopGraphEditValidationInput): Promise<GraphEditResult> {
  const { manifest } = await loadPackage(projectRoot);
  if (input.kind === "addDependencyEdge") {
    return graphEditResult({ ...manifest, edges: [...manifest.edges, { from: input.fromTaskId, to: input.toTaskId, type: "depends_on" }] }, [input.fromTaskId]);
  }
  if (input.kind === "removeDependencyEdge") {
    return graphEditResult(
      {
        ...manifest,
        edges: manifest.edges.filter((edge) => !(edge.from === input.fromTaskId && edge.to === input.toTaskId && edge.type === "depends_on"))
      },
      [input.fromTaskId]
    );
  }
  if (input.kind === "removeTaskNode") {
    return graphEditResult(
      {
        ...manifest,
        nodes: manifest.nodes.filter((node) => node.id !== input.taskId),
        edges: manifest.edges.filter((edge) => edge.from !== input.taskId && edge.to !== input.taskId)
      },
      [input.taskId]
    );
  }

  const graph = compileTaskGraph(manifest);
  const { taskId, blockId } = parseBlockRef(input.blockRef);
  const task = getTask(graph, taskId);
  getBlock(graph, input.blockRef);
  return graphEditResult(
    {
      ...manifest,
      nodes: manifest.nodes.map((node) =>
        node.id === taskId && node.type === "task"
          ? {
              ...task,
              blocks: task.blocks
                .filter((block) => block.id !== blockId)
                .map((block) => ({ ...block, depends_on: block.depends_on.filter((dependency) => dependency !== blockId) }))
            }
          : node
      )
    },
    [taskId]
  );
}

export async function updateTaskTitle(projectRoot: string, taskId: string, title: string): Promise<GraphEditResult> {
  const { manifest } = await loadPackage(projectRoot);
  const graph = compileTaskGraph(manifest);
  const task = getTask(graph, taskId);
  return updateNode({ projectRoot, node: { ...task, title: requireNonEmptyTitle(title) } });
}

export async function updateTaskPrompt(projectRoot: string, taskId: string, markdown: string): Promise<GraphEditResult> {
  const { workspace, manifest } = await loadPackage(projectRoot);
  const task = getTask(compileTaskGraph(manifest), taskId);
  const promptPath = await resolvePackagePath(workspace.packageDir, task.prompt);
  await mkdir(dirname(promptPath), { recursive: true });
  await writeFile(promptPath, markdown, "utf8");
  return { ok: true, affectedTasks: [taskId], diagnostics: [], graph: compileTaskGraph(manifest) };
}

export async function updateBlockTitle(projectRoot: string, ref: string, title: string): Promise<GraphEditResult> {
  const { manifest } = await loadPackage(projectRoot);
  const graph = compileTaskGraph(manifest);
  const { taskId, blockId } = parseBlockRef(ref);
  const task = getTask(graph, taskId);
  if (!task.blocks.some((block) => block.id === blockId)) {
    throw new Error(`Block '${ref}' does not exist.`);
  }
  return updateNode({
    projectRoot,
    node: {
      ...task,
      blocks: task.blocks.map((block) => (block.id === blockId ? { ...block, title: requireNonEmptyTitle(title) } : block))
    }
  });
}

export async function updateBlockPrompt(projectRoot: string, ref: string, markdown: string): Promise<GraphEditResult> {
  const { workspace, manifest } = await loadPackage(projectRoot);
  const graph = compileTaskGraph(manifest);
  const block = getBlock(graph, ref);
  const promptPath = await resolvePackagePath(workspace.packageDir, block.prompt);
  await mkdir(dirname(promptPath), { recursive: true });
  await writeFile(promptPath, markdown, "utf8");
  return { ok: true, affectedTasks: [graph.blockTaskByRef.get(ref) ?? parseBlockRef(ref).taskId], diagnostics: [], graph };
}

export async function updateTaskExecutor(projectRoot: string, taskId: string, executorName: string | null): Promise<GraphEditResult> {
  const { manifest } = await loadPackage(projectRoot);
  const graph = compileTaskGraph(manifest);
  const task = getTask(graph, taskId);
  const executor = normalizeOptionalText(executorName);
  return updateNode({
    projectRoot,
    node: executor === undefined ? { ...task, executor: undefined } : { ...task, executor }
  });
}

export async function updateBlockExecutor(projectRoot: string, ref: string, executorName: string | null): Promise<GraphEditResult> {
  const { manifest } = await loadPackage(projectRoot);
  const graph = compileTaskGraph(manifest);
  const { taskId, blockId } = parseBlockRef(ref);
  const task = getTask(graph, taskId);
  if (!task.blocks.some((block) => block.id === blockId)) {
    throw new Error(`Block '${ref}' does not exist.`);
  }
  const executor = normalizeOptionalText(executorName);
  return updateNode({
    projectRoot,
    node: {
      ...task,
      blocks: task.blocks.map((block) => (block.id === blockId ? { ...block, executor } : block))
    }
  });
}

export function addDependencyEdge(projectRoot: string, fromTaskId: string, toTaskId: string): Promise<GraphEditResult> {
  return addEdge({ projectRoot, edge: { from: fromTaskId, to: toTaskId, type: "depends_on" } });
}

export function removeDependencyEdge(projectRoot: string, fromTaskId: string, toTaskId: string): Promise<GraphEditResult> {
  return removeEdge({ projectRoot, edge: { from: fromTaskId, to: toTaskId, type: "depends_on" } });
}
