import type { DesktopBridgeApi, DesktopCanvasReference, DesktopProjectSummary } from "@planweave-ai/runtime";

export const bridge: DesktopBridgeApi | null = typeof window !== "undefined" && "planweave" in window ? window.planweave : null;

export function desktopCanvasReference(project: DesktopProjectSummary, canvasId?: string | null): DesktopCanvasReference {
  return {
    projectRoot: project.rootPath,
    canvasId
  };
}
