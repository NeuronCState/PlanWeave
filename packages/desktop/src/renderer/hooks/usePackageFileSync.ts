import { useCallback, useEffect } from "react";
import type { DesktopPackageFileChangeEvent, DesktopPackageFileSyncResult, DesktopProjectSummary } from "@planweave-ai/runtime";
import { bridge, desktopCanvasReference } from "../bridge";

type UsePackageFileSyncArgs = {
  reloadCurrentCanvas: () => Promise<void>;
  refreshGraph: () => Promise<void>;
  selectedCanvasId: string | null;
  selectedProject: DesktopProjectSummary | null;
  setDirtyPromptRefs: (refs: string[]) => void;
  setError: (message: string | null) => void;
  setFileSyncDiagnostics: (diagnostics: string[]) => void;
  setFileSyncResult?: (result: DesktopPackageFileSyncResult | null) => void;
  setLastFileChange: (event: DesktopPackageFileChangeEvent | null) => void;
};

export function usePackageFileSync({
  reloadCurrentCanvas,
  refreshGraph,
  selectedCanvasId,
  selectedProject,
  setDirtyPromptRefs,
  setError,
  setFileSyncDiagnostics,
  setFileSyncResult,
  setLastFileChange
}: UsePackageFileSyncArgs) {
  const refreshPackageFiles = useCallback(async () => {
    if (!bridge || !selectedProject) {
      return;
    }
    try {
      const result = await bridge.refreshPackageFileChanges(desktopCanvasReference(selectedProject, selectedCanvasId));
      setDirtyPromptRefs(result.dirtyPromptRefs);
      setFileSyncDiagnostics(result.diagnostics.map((diagnostic) => diagnostic.message));
      setFileSyncResult?.(result);
      if (!result.ok) {
        setError(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
        return;
      }
      if (result.fullRefresh) {
        await reloadCurrentCanvas();
      } else {
        await refreshGraph();
      }
      setDirtyPromptRefs(result.dirtyPromptRefs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [refreshGraph, reloadCurrentCanvas, selectedCanvasId, selectedProject, setDirtyPromptRefs, setError, setFileSyncDiagnostics, setFileSyncResult]);

  useEffect(() => {
    if (!bridge || !selectedProject) {
      return undefined;
    }
    return bridge.onPackageFileChanged((event) => {
      if (event.projectRoot !== selectedProject.rootPath || (event.canvasId ?? null) !== selectedCanvasId) {
        return;
      }
      setLastFileChange(event);
      void refreshPackageFiles();
    });
  }, [refreshPackageFiles, selectedCanvasId, selectedProject, setLastFileChange]);

  return { refreshPackageFiles };
}
