import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { ZodError } from "zod";
import { readJsonFile } from "./json.js";
import { resolveProjectWorkspace } from "./project.js";
import { manifestSchema } from "./schema/manifest.js";
import { hasUserSection } from "./prompt/sections.js";
import type { ManifestTaskNode, PlanPackageManifest, ValidationIssue, ValidationReport } from "./types.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function issue(code: string, message: string, path?: string): ValidationIssue {
  return { code, message, path };
}

function taskNodes(manifest: PlanPackageManifest): ManifestTaskNode[] {
  return manifest.nodes.filter((node): node is ManifestTaskNode => node.type === "task");
}

function findDependsOnCycle(manifest: PlanPackageManifest): string[] | null {
  const graph = new Map<string, string[]>();
  for (const task of taskNodes(manifest)) {
    graph.set(task.id, []);
  }
  for (const edge of manifest.edges) {
    if (edge.type === "depends_on" && graph.has(edge.from)) {
      graph.get(edge.from)?.push(edge.to);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function visit(id: string): string[] | null {
    if (visiting.has(id)) {
      return stack.slice(stack.indexOf(id)).concat(id);
    }
    if (visited.has(id)) {
      return null;
    }
    visiting.add(id);
    stack.push(id);
    for (const next of graph.get(id) ?? []) {
      const cycle = visit(next);
      if (cycle) {
        return cycle;
      }
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  }

  for (const id of graph.keys()) {
    const cycle = visit(id);
    if (cycle) {
      return cycle;
    }
  }

  return null;
}

export async function validatePackage(options: { projectRoot: string }): Promise<ValidationReport> {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const workspace = await resolveProjectWorkspace(options.projectRoot);

  if (!(await exists(workspace.workspaceRoot))) {
    errors.push(issue("workspace_missing", "PlanWeave workspace does not exist.", workspace.workspaceRoot));
    return { ok: false, errors, warnings };
  }

  if (!(await exists(workspace.manifestFile))) {
    errors.push(issue("manifest_missing", "package/manifest.json does not exist.", workspace.manifestFile));
    return { ok: false, errors, warnings };
  }

  let manifest: PlanPackageManifest;
  try {
    manifest = manifestSchema.parse(await readJsonFile<unknown>(workspace.manifestFile)) as PlanPackageManifest;
  } catch (error) {
    if (error instanceof ZodError) {
      for (const zodIssue of error.issues) {
        errors.push(
          issue("manifest_schema", zodIssue.message, zodIssue.path.length > 0 ? zodIssue.path.join(".") : undefined)
        );
      }
    } else {
      errors.push(issue("manifest_read_failed", error instanceof Error ? error.message : String(error), workspace.manifestFile));
    }
    return { ok: false, errors, warnings };
  }

  const nodeIds = new Set<string>();
  const duplicateNodeIds = new Set<string>();
  for (const node of manifest.nodes) {
    if (nodeIds.has(node.id)) {
      duplicateNodeIds.add(node.id);
    }
    nodeIds.add(node.id);
  }
  for (const id of duplicateNodeIds) {
    errors.push(issue("node_id_duplicate", `Node id '${id}' is duplicated.`, "nodes"));
  }

  if (!(await exists(join(workspace.packageDir, manifest.global_prompt)))) {
    errors.push(issue("global_prompt_missing", "global_prompt file does not exist.", manifest.global_prompt));
  }

  for (const edge of manifest.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(issue("edge_from_missing", `Edge references missing from node '${edge.from}'.`, "edges"));
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(issue("edge_to_missing", `Edge references missing to node '${edge.to}'.`, "edges"));
    }
  }

  const cycle = findDependsOnCycle(manifest);
  if (cycle) {
    errors.push(issue("depends_on_cycle", `depends_on cycle detected: ${cycle.join(" -> ")}.`, "edges"));
  }

  for (const task of taskNodes(manifest)) {
    const promptPath = join(workspace.packageDir, task.prompt);
    if (!(await exists(promptPath))) {
      errors.push(issue("prompt_missing", `Prompt Surface file for '${task.id}' does not exist.`, task.prompt));
      continue;
    }
    const prompt = await import("node:fs/promises").then((fs) => fs.readFile(promptPath, "utf8"));
    if (!hasUserSection(prompt, "task-body")) {
      errors.push(issue("task_body_missing", `Prompt Surface for '${task.id}' is missing user section 'task-body'.`, task.prompt));
    }
    const hasGoalOrRequirement = manifest.edges.some((edge) => {
      if (edge.from !== task.id && edge.to !== task.id) {
        return false;
      }
      const otherId = edge.from === task.id ? edge.to : edge.from;
      const other = manifest.nodes.find((node) => node.id === otherId);
      return other?.type === "goal" || other?.type === "requirement";
    });
    if (!hasGoalOrRequirement) {
      warnings.push(issue("task_without_goal_or_requirement", `Task '${task.id}' has no goal or requirement relationship.`, task.id));
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}
