import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { ExecutionStatus } from "../../taskManager/executionStatus.js";
import type { ProjectWorkspace } from "../../types.js";
import type { DesktopStatistics } from "../types.js";
import { loadProjectTodoContext, type ProjectTodoContext } from "./todoModel.js";

async function listResultFiles(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await listResultFiles(path)));
      } else if (entry.isFile() && /\.(md|json|log|txt)$/.test(entry.name)) {
        files.push(path);
      }
    }
    return files;
  } catch {
    return [];
  }
}

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

async function readJsonObject(path: string): Promise<Record<string, unknown> | null> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

type StatisticsParts = {
  stats: DesktopStatistics;
  implementationDurations: number[];
  reviewBlockCount: number;
};

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

async function implementationDurationsForWorkspace(workspace: ProjectWorkspace): Promise<number[]> {
  const implementationDurations: number[] = [];
  for (const file of await listResultFiles(workspace.resultsDir)) {
    const relativePath = toPosixPath(relative(workspace.resultsDir, file));
    if (!relativePath.includes("/blocks/") || !relativePath.endsWith("/metadata.json")) {
      continue;
    }
    const metadata = await readJsonObject(file);
    const startedAt = typeof metadata?.startedAt === "string" ? Date.parse(metadata.startedAt) : Number.NaN;
    const finishedAt = typeof metadata?.finishedAt === "string" ? Date.parse(metadata.finishedAt) : Number.NaN;
    if (Number.isFinite(startedAt) && Number.isFinite(finishedAt) && finishedAt >= startedAt) {
      implementationDurations.push(finishedAt - startedAt);
    }
  }
  return implementationDurations;
}

function statisticsPartsFromStatus(status: ExecutionStatus, implementationDurations: number[]): StatisticsParts {
  const reviewBlockCount = status.blocks.filter((block) => block.type === "review").length;
  const reviewPassedCount = status.blocks.filter((block) => block.type === "review" && block.completionReason === "passed").length;
  const feedbackEnvelopeCount = Object.values(status.counts.feedback).reduce((sum, count) => sum + count, 0);
  return {
    implementationDurations,
    reviewBlockCount,
    stats: {
      taskTotal: status.taskTotal,
      implementedTaskCount: status.counts.tasks.implemented,
      implementedRatio: status.taskTotal === 0 ? 0 : status.counts.tasks.implemented / status.taskTotal,
      taskThroughput: status.counts.tasks.implemented,
      blockTotal: status.blockTotal,
      completedBlockCount: status.counts.blocks.completed,
      averageImplementationTimeMs:
        implementationDurations.length === 0
          ? null
          : Math.round(implementationDurations.reduce((sum, duration) => sum + duration, 0) / implementationDurations.length),
      reviewPassedCount,
      reviewPassedRatio: reviewBlockCount === 0 ? 0 : reviewPassedCount / reviewBlockCount,
      feedbackEnvelopeCount,
      reworkCount: feedbackEnvelopeCount,
      estimatedRemainingBlocks: status.blockTotal - status.counts.blocks.completed
    }
  };
}

function mergeStatisticsParts(parts: StatisticsParts[]): DesktopStatistics {
  const totals = parts.reduce(
    (sum, part) => ({
      taskTotal: sum.taskTotal + part.stats.taskTotal,
      implementedTaskCount: sum.implementedTaskCount + part.stats.implementedTaskCount,
      taskThroughput: sum.taskThroughput + part.stats.taskThroughput,
      blockTotal: sum.blockTotal + part.stats.blockTotal,
      completedBlockCount: sum.completedBlockCount + part.stats.completedBlockCount,
      reviewBlockCount: sum.reviewBlockCount + part.reviewBlockCount,
      reviewPassedCount: sum.reviewPassedCount + part.stats.reviewPassedCount,
      feedbackEnvelopeCount: sum.feedbackEnvelopeCount + part.stats.feedbackEnvelopeCount,
      reworkCount: sum.reworkCount + part.stats.reworkCount,
      estimatedRemainingBlocks: sum.estimatedRemainingBlocks + part.stats.estimatedRemainingBlocks,
      implementationDurations: [...sum.implementationDurations, ...part.implementationDurations]
    }),
    {
      taskTotal: 0,
      implementedTaskCount: 0,
      taskThroughput: 0,
      blockTotal: 0,
      completedBlockCount: 0,
      reviewBlockCount: 0,
      reviewPassedCount: 0,
      feedbackEnvelopeCount: 0,
      reworkCount: 0,
      estimatedRemainingBlocks: 0,
      implementationDurations: [] as number[]
    }
  );
  return {
    taskTotal: totals.taskTotal,
    implementedTaskCount: totals.implementedTaskCount,
    implementedRatio: totals.taskTotal === 0 ? 0 : totals.implementedTaskCount / totals.taskTotal,
    taskThroughput: totals.taskThroughput,
    blockTotal: totals.blockTotal,
    completedBlockCount: totals.completedBlockCount,
    averageImplementationTimeMs:
      totals.implementationDurations.length === 0
        ? null
        : Math.round(totals.implementationDurations.reduce((sum, duration) => sum + duration, 0) / totals.implementationDurations.length),
    reviewPassedCount: totals.reviewPassedCount,
    reviewPassedRatio: totals.reviewBlockCount === 0 ? 0 : totals.reviewPassedCount / totals.reviewBlockCount,
    feedbackEnvelopeCount: totals.feedbackEnvelopeCount,
    reworkCount: totals.reworkCount,
    estimatedRemainingBlocks: totals.estimatedRemainingBlocks
  };
}

export async function buildStatisticsFromProjectTodoContext(context: ProjectTodoContext): Promise<DesktopStatistics> {
  const parts: StatisticsParts[] = [];
  for (const canvasId of context.aggregation.orderedCanvasIds) {
    const canvas = context.aggregation.canvasesById.get(canvasId);
    const snapshot = context.snapshotsByCanvas.get(canvasId);
    if (!canvas) {
      throw new Error(`Canvas '${canvasId}' is missing from project aggregation.`);
    }
    if (!snapshot) {
      throw new Error(`Canvas '${canvasId}' execution snapshot is missing.`);
    }
    if (snapshot.error) {
      throw new Error(`Canvas '${canvasId}' execution snapshot failed: ${errorMessage(snapshot.error)}`);
    }
    if (!snapshot.status) {
      throw new Error(`Canvas '${canvasId}' execution status is unavailable.`);
    }
    parts.push(statisticsPartsFromStatus(snapshot.status, await implementationDurationsForWorkspace(canvas.workspace)));
  }
  return mergeStatisticsParts(parts);
}

export async function getStatistics(projectRoot: string): Promise<DesktopStatistics> {
  return buildStatisticsFromProjectTodoContext(await loadProjectTodoContext(projectRoot));
}
