import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { loadPackage } from "../../package/loadPackage.js";
import { getExecutionStatus } from "../../taskManager/index.js";
import type { DesktopStatistics } from "../types.js";

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

export async function getStatistics(projectRoot: string): Promise<DesktopStatistics> {
  const { workspace } = await loadPackage(projectRoot);
  const status = await getExecutionStatus({ projectRoot });
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
  const reviewBlockCount = status.blocks.filter((block) => block.type === "review").length;
  const reviewPassedCount = status.blocks.filter((block) => block.type === "review" && block.completionReason === "passed").length;
  const feedbackEnvelopeCount = Object.values(status.counts.feedback).reduce((sum, count) => sum + count, 0);
  return {
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
  };
}
