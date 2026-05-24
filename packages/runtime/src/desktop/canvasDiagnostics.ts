import { ZodError } from "zod";
import { compilePackageGraph } from "../graph/compileTaskGraph.js";
import { readJsonFile } from "../json.js";
import { manifestSchema } from "../schema/manifest.js";
import type { PlanPackageManifest, ProjectWorkspace, ValidationIssue } from "../types.js";

function issue(code: string, message: string, path?: string): ValidationIssue {
  return { code, message, path };
}

export async function canvasDiagnostics(workspace: ProjectWorkspace): Promise<ValidationIssue[]> {
  try {
    const manifest = manifestSchema.parse(await readJsonFile<unknown>(workspace.manifestFile)) as PlanPackageManifest;
    const graph = await compilePackageGraph(manifest, workspace.packageDir);
    return [...graph.diagnostics.errors, ...graph.diagnostics.warnings];
  } catch (error) {
    if (error instanceof ZodError) {
      return error.issues.map((zodIssue) =>
        issue("manifest_schema", zodIssue.message, zodIssue.path.length > 0 ? zodIssue.path.join(".") : "manifest.json")
      );
    }
    return [issue("manifest_read_failed", error instanceof Error ? error.message : String(error), workspace.manifestFile)];
  }
}
