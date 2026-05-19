import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadPackage } from "../package/loadPackage.js";
import { readState, ensureStateForManifest, writeState } from "../state.js";
import { formatSection, getPromptSection } from "./sections.js";
import { renderManagedSections } from "./renderManagedSections.js";
import type { ManifestTaskNode, PromptSurface } from "../types.js";

function findTask(tasks: ManifestTaskNode[], taskId: string): ManifestTaskNode {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) {
    throw new Error(`Task '${taskId}' does not exist.`);
  }
  return task;
}

export async function refreshPrompt(options: { projectRoot: string; taskId: string }): Promise<PromptSurface> {
  const { workspace, manifest } = await loadPackage(options.projectRoot);
  const task = findTask(
    manifest.nodes.filter((node): node is ManifestTaskNode => node.type === "task"),
    options.taskId
  );
  const promptPath = join(workspace.packageDir, task.prompt);
  const existing = await readFile(promptPath, "utf8");
  const taskBody = getPromptSection(existing, "user", "task-body");
  if (taskBody === null) {
    throw new Error(`Prompt Surface for '${task.id}' is missing user section 'task-body'.`);
  }

  const state = ensureStateForManifest(manifest, await readState(workspace.stateFile));
  await writeState(workspace.stateFile, state);
  const globalPrompt = await readFile(join(workspace.packageDir, manifest.global_prompt), "utf8");
  const managed = await renderManagedSections({ workspace, manifest, state, task, globalPrompt });
  const markdown = [
    `# ${task.id}: ${task.title}`,
    formatSection("managed", "header", managed.header),
    formatSection("managed", "global", managed.global),
    formatSection("managed", "runtime-feedback", managed["runtime-feedback"]),
    formatSection("user", "task-body", taskBody),
    formatSection("managed", "acceptance", managed.acceptance),
    formatSection("managed", "graph-context", managed["graph-context"]),
    formatSection("managed", "dependency-status", managed["dependency-status"]),
    formatSection("managed", "latest-run", managed["latest-run"]),
    formatSection("managed", "completion", managed.completion)
  ].join("\n\n");

  await writeFile(promptPath, `${markdown}\n`, "utf8");
  return {
    taskId: task.id,
    path: promptPath,
    markdown: `${markdown}\n`
  };
}
