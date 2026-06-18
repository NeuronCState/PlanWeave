import type { ValidationIssue } from "../../types.js";
import type { DesktopSearchFilters, DesktopSearchResult } from "../types.js";
import { appendDesktopDiagnostics } from "./desktopDiagnostics.js";
import { readDesktopProjectProjection, readDesktopProjectSearchIndex } from "./projectProjectionModel.js";
import { searchDesktopSearchIndex } from "./searchIndexModel.js";

export type DesktopSearchProjection = {
  results: DesktopSearchResult[];
  diagnostics: ValidationIssue[];
};

export async function searchProjectWithDiagnostics(
  projectRoot: string,
  query: string,
  filters: DesktopSearchFilters = {}
): Promise<DesktopSearchProjection> {
  const projection = await readDesktopProjectProjection(projectRoot);
  const diagnostics: ValidationIssue[] = [...projection.diagnostics];

  if (typeof filters.canvasId === "string" && !projection.todoContext.aggregation.canvasesById.has(filters.canvasId)) {
    throw new Error(`Task canvas '${filters.canvasId}' does not exist.`);
  }

  const index = await readDesktopProjectSearchIndex(projectRoot);
  appendDesktopDiagnostics(diagnostics, index.diagnostics);
  return {
    results: searchDesktopSearchIndex(index, query, filters),
    diagnostics
  };
}

export async function searchProject(projectRoot: string, query: string, filters: DesktopSearchFilters = {}): Promise<DesktopSearchResult[]> {
  return (await searchProjectWithDiagnostics(projectRoot, query, filters)).results;
}
