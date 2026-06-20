import type { BlockType, DesktopUpdateReviewPipelineInput, ProjectTaskRef, ReviewHookDefinition, ReviewTriggerCondition } from "@planweave-ai/runtime";
import {
  blockRefFromArgs,
  jsonToolResult,
  nonEmptyString,
  optionalNonEmptyString,
  optionalNullableString,
  optionalStringArray,
  parseProjectCanvasArgs,
  readObjectArgs
} from "./toolHelpers.js";
import type { RuntimeGateway } from "./toolTypes.js";

export function parseCreateTaskInput(record: Record<string, unknown>) {
  return {
    title: nonEmptyString(record.title, "title"),
    promptMarkdown: requiredMarkdown(record.promptMarkdown),
    acceptance: optionalStringArray(record.acceptance, "acceptance"),
    blockTypes: parseBlockTypes(record.blockTypes),
    executor: optionalNullableString(record.executor, "executor")
  };
}

export function parseCreateBlockInput(record: Record<string, unknown>) {
  return {
    taskId: nonEmptyString(record.taskId, "taskId"),
    type: parseBlockType(record.type),
    title: nonEmptyString(record.title, "title"),
    promptMarkdown: requiredMarkdown(record.promptMarkdown),
    executor: optionalNullableString(record.executor, "executor"),
    dependsOn: optionalStringArray(record.dependsOn, "dependsOn")
  };
}

export function parseUpdateInput(record: Record<string, unknown>) {
  const input = {
    title: optionalNonEmptyString(record.title, "title"),
    promptMarkdown: record.promptMarkdown === undefined ? undefined : requiredMarkdown(record.promptMarkdown),
    executor: optionalNullableString(record.executor, "executor")
  };
  if (input.title === undefined && input.promptMarkdown === undefined && input.executor === undefined) {
    throw new Error("At least one of title, promptMarkdown, or executor must be provided.");
  }
  return input;
}

export function parseTaskAcceptanceInput(record: Record<string, unknown>): string[] {
  const acceptance = requiredStringArray(record.acceptance, "acceptance");
  if (acceptance.length === 0) {
    throw new Error("acceptance must include at least one item.");
  }
  return acceptance;
}

export function parseBlockDependenciesInput(record: Record<string, unknown>): string[] {
  return requiredStringArray(record.dependsOn, "dependsOn");
}

export function parseBlockPlanningInput(record: Record<string, unknown>) {
  const input = {
    parallelSafe: optionalBoolean(record.parallelSafe, "parallelSafe"),
    parallelLocks: record.parallelLocks === undefined ? undefined : requiredStringArray(record.parallelLocks, "parallelLocks"),
    reviewRequired: optionalBoolean(record.reviewRequired, "reviewRequired"),
    maxFeedbackCycles: optionalNonNegativeInteger(record.maxFeedbackCycles, "maxFeedbackCycles"),
    reviewHook: parseOptionalReviewHook(record.reviewHook, "reviewHook")
  };
  if (
    input.parallelSafe === undefined &&
    input.parallelLocks === undefined &&
    input.reviewRequired === undefined &&
    input.maxFeedbackCycles === undefined &&
    input.reviewHook === undefined
  ) {
    throw new Error("At least one block planning field must be provided.");
  }
  return input;
}

export function parseReviewPipelineInput(record: Record<string, unknown>): DesktopUpdateReviewPipelineInput {
  return {
    packageDefaults: parsePackageDefaults(record.packageDefaults),
    steps: parseReviewSteps(record.steps)
  };
}

export function parseProjectTaskRefs(record: Record<string, unknown>): { from: ProjectTaskRef; to: ProjectTaskRef } {
  return {
    from: {
      canvasId: nonEmptyString(record.fromCanvasId, "fromCanvasId"),
      taskId: nonEmptyString(record.fromTaskId, "fromTaskId")
    },
    to: {
      canvasId: nonEmptyString(record.toCanvasId, "toCanvasId"),
      taskId: nonEmptyString(record.toTaskId, "toTaskId")
    }
  };
}

export function requiredMarkdown(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("markdown or promptMarkdown must be a string.");
  }
  return value;
}

export async function readPrompt(args: unknown, gateway: RuntimeGateway) {
  const record = readObjectArgs(args);
  const { projectId, canvasId } = parseProjectCanvasArgs(record);
  const target = nonEmptyString(record.target, "target");
  if (target === "project") {
    return jsonToolResult({ target, markdown: await gateway.readProjectPrompt(projectId) });
  }
  if (target === "task") {
    const task = await gateway.getTaskDetail(projectId, nonEmptyString(record.taskId, "taskId"), canvasId);
    return jsonToolResult({ target, taskId: task.taskId, markdown: task.promptMarkdown, promptMissing: task.promptMissing });
  }
  if (target === "block") {
    const block = await gateway.getBlockDetail(projectId, blockRefFromArgs(record), canvasId);
    return jsonToolResult({
      target,
      blockRef: block.ref,
      markdown: record.rendered === true ? block.promptSurfaceMarkdown : block.promptMarkdown,
      promptMissing: block.promptMissing,
      rendered: record.rendered === true
    });
  }
  throw new Error("target must be one of: project, task, block.");
}

function parseBlockTypes(value: unknown): BlockType[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error("blockTypes must be an array.");
  }
  return value.map((item, index) => parseBlockType(item, `blockTypes[${index}]`));
}

function parseBlockType(value: unknown, field = "type"): BlockType {
  if (value !== "implementation" && value !== "review") {
    throw new Error(`${field} must be one of: implementation, review.`);
  }
  return value;
}

function requiredStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array.`);
  }
  return value.map((item, index) => nonEmptyString(item, `${field}[${index}]`));
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean.`);
  }
  return value;
}

function optionalNonNegativeInteger(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer.`);
  }
  return value;
}

function recordValue(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function parseReviewHook(value: unknown, field: string): ReviewHookDefinition {
  const record = recordValue(value, field);
  const args = record.args === undefined ? [] : requiredStringArray(record.args, `${field}.args`);
  const hook = {
    id: nonEmptyString(record.id, `${field}.id`),
    type: nonEmptyString(record.type, `${field}.type`),
    command: nonEmptyString(record.command, `${field}.command`),
    args,
    executionPolicy: nonEmptyString(record.executionPolicy, `${field}.executionPolicy`)
  };
  if (hook.type !== "executable") {
    throw new Error(`${field}.type must be executable.`);
  }
  if (hook.executionPolicy !== "trusted-local") {
    throw new Error(`${field}.executionPolicy must be trusted-local.`);
  }
  return { ...hook, type: "executable", executionPolicy: "trusted-local" };
}

function parseOptionalReviewHook(value: unknown, field: string): ReviewHookDefinition | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return parseReviewHook(value, field);
}

function parseTriggerCondition(value: unknown, field: string): ReviewTriggerCondition {
  if (value === undefined) {
    return "after_required_work_completed";
  }
  if (value !== "after_required_work_completed" && value !== "manual") {
    throw new Error(`${field} must be one of: after_required_work_completed, manual.`);
  }
  return value;
}

function parsePackageDefaults(value: unknown): DesktopUpdateReviewPipelineInput["packageDefaults"] {
  if (value === undefined) {
    return undefined;
  }
  const record = recordValue(value, "packageDefaults");
  const maxFeedbackCycles = optionalNonNegativeInteger(record.maxFeedbackCycles, "packageDefaults.maxFeedbackCycles");
  if (maxFeedbackCycles === undefined) {
    throw new Error("packageDefaults.maxFeedbackCycles is required.");
  }
  if (record.completionPolicy !== "strict") {
    throw new Error("packageDefaults.completionPolicy must be strict.");
  }
  return { maxFeedbackCycles, completionPolicy: "strict" };
}

function blockIdFromStep(record: Record<string, unknown>, index: number): string | undefined {
  if (record.blockId !== undefined) {
    return nonEmptyString(record.blockId, `steps[${index}].blockId`);
  }
  if (record.blockRef === undefined) {
    return undefined;
  }
  const blockRef = nonEmptyString(record.blockRef, `steps[${index}].blockRef`);
  const separator = blockRef.indexOf("#");
  if (separator <= 0 || separator === blockRef.length - 1) {
    throw new Error(`steps[${index}].blockRef must use '<taskId>#<blockId>'.`);
  }
  return blockRef.slice(separator + 1);
}

function parseReviewSteps(value: unknown): DesktopUpdateReviewPipelineInput["steps"] {
  if (!Array.isArray(value)) {
    throw new Error("steps must be an array.");
  }
  return value.map((item, index) => {
    const record = recordValue(item, `steps[${index}]`);
    return {
      blockId: blockIdFromStep(record, index) ?? "",
      blockRef: typeof record.blockRef === "string" ? record.blockRef : null,
      title: nonEmptyString(record.title, `steps[${index}].title`),
      enabled: optionalBoolean(record.enabled, `steps[${index}].enabled`) ?? true,
      preset: nonEmptyString(record.preset, `steps[${index}].preset`),
      triggerCondition: parseTriggerCondition(record.triggerCondition, `steps[${index}].triggerCondition`),
      inputContext: nonEmptyString(record.inputContext, `steps[${index}].inputContext`),
      passCriteria: nonEmptyString(record.passCriteria, `steps[${index}].passCriteria`),
      feedbackFormat: nonEmptyString(record.feedbackFormat, `steps[${index}].feedbackFormat`),
      maxFeedbackCycles: optionalNonNegativeInteger(record.maxFeedbackCycles, `steps[${index}].maxFeedbackCycles`) ?? 1,
      hook: parseOptionalReviewHook(record.hook, `steps[${index}].hook`) ?? null,
      promptMarkdown: requiredMarkdown(record.promptMarkdown)
    };
  });
}
