import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { ZodError } from "zod";
import { compilePackageGraph } from "./graph/compileTaskGraph.js";
import { readJsonFile } from "./json.js";
import { resolveProjectWorkspace } from "./project.js";
import { manifestSchema } from "./schema/manifest.js";
import type { PlanPackageManifest, ValidationIssue, ValidationReport } from "./types.js";

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

  const graph = await compilePackageGraph(manifest, workspace.packageDir);
  errors.push(...graph.diagnostics.errors);
  warnings.push(...graph.diagnostics.warnings);

  if (!(await exists(join(workspace.packageDir, manifest.global_prompt)))) {
    errors.push(issue("global_prompt_missing", "global_prompt file does not exist.", manifest.global_prompt));
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}
