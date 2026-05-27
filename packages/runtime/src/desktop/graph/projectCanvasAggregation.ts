import { listTaskCanvases, resolveTaskCanvasWorkspace } from "../canvasApi.js";
import type { DesktopTaskCanvasSummary } from "../types.js";
import type { ProjectWorkspace } from "../../types.js";

export type ProjectTaskCanvasContext = {
  canvasId: string;
  canvasName: string;
  canvas: DesktopTaskCanvasSummary;
  workspace: ProjectWorkspace;
};

export async function mapProjectTaskCanvases<T>(
  projectRoot: string,
  mapper: (context: ProjectTaskCanvasContext, index: number) => Promise<T>
): Promise<T[]> {
  const canvases = await listTaskCanvases(projectRoot);
  const results: T[] = [];
  for (const canvas of canvases) {
    const hasPackageDiagnostics = canvas.diagnostics.some(
      (diagnostic) => diagnostic.code === "manifest_schema" || diagnostic.code === "manifest_read_failed"
    );
    if (hasPackageDiagnostics) {
      continue;
    }
    results.push(
      await mapper(
        {
          canvas,
          canvasId: canvas.canvasId,
          canvasName: canvas.name,
          workspace: await resolveTaskCanvasWorkspace(projectRoot, canvas.canvasId)
        },
        results.length
      )
    );
  }
  return results;
}
