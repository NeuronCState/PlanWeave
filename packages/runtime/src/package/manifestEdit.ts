import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { compileTaskGraph, parseBlockRef } from "../graph/compileTaskGraph.js";
import { writeJsonFile } from "../json.js";
import { manifestSchema } from "../schema/manifest.js";
import type {
  EditBlockInput,
  EditBlockResult,
  EditTaskInput,
  EditTaskResult,
  GraphEditResult,
  ManifestBlock,
  ManifestImplementationBlock,
  ManifestReviewBlock,
  ManifestTaskNode,
  PlanPackageManifest,
  ValidationIssue
} from "../types.js";
import { loadPackage } from "./loadPackage.js";
import { resolvePackagePath } from "./resolvePackagePath.js";

function issue(code: string, message: string, path?: string): ValidationIssue {
  return { code, message, path };
}

function validationIssues(manifest: PlanPackageManifest): ValidationIssue[] {
  const parsed = manifestSchema.safeParse(manifest);
  if (!parsed.success) {
    return parsed.error.issues.map((item) =>
      issue("manifest_schema_invalid", item.message, item.path.length > 0 ? item.path.join(".") : "manifest.json")
    );
  }
  return compileTaskGraph(manifest).diagnostics.errors;
}

function graphEditResult(manifest: PlanPackageManifest, affectedTasks: string[], diagnostics: ValidationIssue[] = []): GraphEditResult {
  const graph = compileTaskGraph(manifest);
  const allDiagnostics = [...diagnostics, ...graph.diagnostics.errors];
  return {
    ok: allDiagnostics.length === 0,
    affectedTasks: [...new Set(affectedTasks)],
    diagnostics: allDiagnostics,
    graph
  };
}

function nonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty.`);
  }
  return trimmed;
}

function optionalText(value: string | null): string | undefined {
  if (value === null) {
    return undefined;
  }
  return nonEmpty(value, "executor");
}

function normalizeMaxFeedbackCycles(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("maxFeedbackCycles must be a non-negative integer.");
  }
  return value;
}

async function writePromptMarkdown(packageDir: string, packagePath: string, markdown: string): Promise<void> {
  const targetPath = await resolvePackagePath(packageDir, packagePath, { forWrite: true });
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, markdown, "utf8");
}

function requireTask(manifest: PlanPackageManifest, taskId: string): ManifestTaskNode {
  const task = manifest.nodes.find((node) => node.type === "task" && node.id === taskId);
  if (!task || task.type !== "task") {
    throw new Error(`Task '${taskId}' does not exist.`);
  }
  return task;
}

function replaceTask(manifest: PlanPackageManifest, task: ManifestTaskNode): PlanPackageManifest {
  return {
    ...manifest,
    nodes: manifest.nodes.map((node) => (node.type === "task" && node.id === task.id ? task : node))
  };
}

async function writeManifestEdit(options: {
  manifestFile: string;
  manifest: PlanPackageManifest;
  affectedTasks: string[];
}): Promise<GraphEditResult> {
  const diagnostics = validationIssues(options.manifest);
  if (diagnostics.length > 0) {
    return graphEditResult(options.manifest, options.affectedTasks, diagnostics);
  }
  await writeJsonFile(options.manifestFile, options.manifest);
  return graphEditResult(options.manifest, options.affectedTasks);
}

export async function editTask(options: EditTaskInput): Promise<EditTaskResult> {
  const { workspace, manifest } = await loadPackage(options.projectRoot);
  const task = requireTask(manifest, options.taskId);
  const updatedFields: string[] = [];
  let nextTask: ManifestTaskNode = task;
  if (options.title !== undefined) {
    nextTask = { ...nextTask, title: nonEmpty(options.title, "title") };
    updatedFields.push("title");
  }
  if (options.promptMarkdown !== undefined) {
    updatedFields.push("prompt");
  }
  if (options.executor !== undefined) {
    const executor = optionalText(options.executor);
    nextTask = {
      ...nextTask,
      ...(executor === undefined ? { executor: undefined } : { executor }),
      blocks: nextTask.blocks.map((block) => ({ ...block, executor: undefined }))
    };
    updatedFields.push("executor");
  }
  if (updatedFields.length === 0) {
    throw new Error("edit-task requires at least one field to update.");
  }
  const nextManifest = replaceTask(manifest, nextTask);
  const diagnostics = validationIssues(nextManifest);
  if (diagnostics.length > 0) {
    return { ...graphEditResult(nextManifest, [options.taskId], diagnostics), taskId: options.taskId, updatedFields };
  }
  if (options.promptMarkdown !== undefined) {
    await writePromptMarkdown(workspace.packageDir, nextTask.prompt, options.promptMarkdown);
  }
  const result = await writeManifestEdit({ manifestFile: workspace.manifestFile, manifest: nextManifest, affectedTasks: [options.taskId] });
  return { ...result, taskId: options.taskId, updatedFields };
}

function editImplementationBlock(
  block: ManifestImplementationBlock,
  options: Pick<EditBlockInput, "parallelSafe" | "parallelLocks">
): { block: ManifestImplementationBlock; fields: string[] } {
  const fields: string[] = [];
  let next = block;
  if (options.parallelSafe !== undefined) {
    next = { ...next, parallel: { ...next.parallel, safe: options.parallelSafe } };
    fields.push("parallel.safe");
  }
  if (options.parallelLocks !== undefined) {
    next = { ...next, parallel: { ...next.parallel, locks: options.parallelLocks.map((lock) => nonEmpty(lock, "parallel lock")) } };
    fields.push("parallel.locks");
  }
  return { block: next, fields };
}

function editReviewBlock(
  block: ManifestReviewBlock,
  options: Pick<EditBlockInput, "reviewRequired" | "maxFeedbackCycles" | "reviewHook">
): { block: ManifestReviewBlock; fields: string[] } {
  const fields: string[] = [];
  let next = block;
  if (options.reviewRequired !== undefined) {
    next = { ...next, review: { ...next.review, required: options.reviewRequired } };
    fields.push("review.required");
  }
  if (options.maxFeedbackCycles !== undefined) {
    next = { ...next, review: { ...next.review, maxFeedbackCycles: normalizeMaxFeedbackCycles(options.maxFeedbackCycles) } };
    fields.push("review.maxFeedbackCycles");
  }
  if (options.reviewHook !== undefined) {
    next = { ...next, review: { ...next.review, hook: options.reviewHook } };
    fields.push("review.hook");
  }
  return { block: next, fields };
}

function ensureBlockFieldCompatibility(block: ManifestBlock, options: EditBlockInput): void {
  if (block.type !== "implementation" && (options.parallelSafe !== undefined || options.parallelLocks !== undefined)) {
    throw new Error("parallel fields can only be edited on implementation blocks.");
  }
  if (
    block.type !== "review" &&
    (options.reviewRequired !== undefined || options.maxFeedbackCycles !== undefined || options.reviewHook !== undefined)
  ) {
    throw new Error("review fields can only be edited on review blocks.");
  }
}

export async function editBlock(options: EditBlockInput): Promise<EditBlockResult> {
  const { workspace, manifest } = await loadPackage(options.projectRoot);
  const { taskId, blockId } = parseBlockRef(options.ref);
  const task = requireTask(manifest, taskId);
  const block = task.blocks.find((item) => item.id === blockId);
  if (!block) {
    throw new Error(`Block '${options.ref}' does not exist.`);
  }
  ensureBlockFieldCompatibility(block, options);
  const updatedFields: string[] = [];
  let nextBlock: ManifestBlock = block;
  if (options.title !== undefined) {
    nextBlock = { ...nextBlock, title: nonEmpty(options.title, "title") };
    updatedFields.push("title");
  }
  if (options.promptMarkdown !== undefined) {
    updatedFields.push("prompt");
  }
  if (options.executor !== undefined) {
    const executor = optionalText(options.executor);
    nextBlock = executor === undefined ? { ...nextBlock, executor: undefined } : { ...nextBlock, executor };
    updatedFields.push("executor");
  }
  if (nextBlock.type === "implementation") {
    const edited = editImplementationBlock(nextBlock, options);
    nextBlock = edited.block;
    updatedFields.push(...edited.fields);
  } else {
    const edited = editReviewBlock(nextBlock, options);
    nextBlock = edited.block;
    updatedFields.push(...edited.fields);
  }
  if (updatedFields.length === 0) {
    throw new Error("edit-block requires at least one field to update.");
  }
  const nextTask: ManifestTaskNode = {
    ...task,
    blocks: task.blocks.map((item) => (item.id === blockId ? nextBlock : item))
  };
  const nextManifest = replaceTask(manifest, nextTask);
  const diagnostics = validationIssues(nextManifest);
  if (diagnostics.length > 0) {
    return { ...graphEditResult(nextManifest, [taskId], diagnostics), ref: options.ref, taskId, blockId, blockType: block.type, updatedFields };
  }
  if (options.promptMarkdown !== undefined) {
    await writePromptMarkdown(workspace.packageDir, nextBlock.prompt, options.promptMarkdown);
  }
  const result = await writeManifestEdit({ manifestFile: workspace.manifestFile, manifest: nextManifest, affectedTasks: [taskId] });
  return { ...result, ref: options.ref, taskId, blockId, blockType: block.type, updatedFields };
}
