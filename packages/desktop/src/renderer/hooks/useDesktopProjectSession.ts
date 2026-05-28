import { useCallback, useEffect } from "react";
import type { DesktopAutoRunState, DesktopBlockDetail, DesktopProjectSummary, DesktopRunRecord } from "@planweave-ai/runtime";
import { bridge } from "../bridge";
import { resolveProjectCanvasId, useDesktopProject } from "./useDesktopProject";

type DesktopProjectState = ReturnType<typeof useDesktopProject>;

type UseDesktopProjectSessionArgs = {
  clearSelectedBlockRecords: () => void;
  projectState: DesktopProjectState;
  setAutoRunState: (state: DesktopAutoRunState | null) => void;
  setBlockInspectorOpen: (open: boolean) => void;
  setSelectedBlock: (block: DesktopBlockDetail | null) => void;
  setSelectedRunRecord: (record: DesktopRunRecord | null) => void;
};

export function useDesktopProjectSession({
  clearSelectedBlockRecords,
  projectState,
  setAutoRunState,
  setBlockInspectorOpen,
  setSelectedBlock,
  setSelectedRunRecord
}: UseDesktopProjectSessionArgs) {
  const clearSelectionForCanvasChange = useCallback(() => {
    setSelectedBlock(null);
    setSelectedRunRecord(null);
    setBlockInspectorOpen(false);
    clearSelectedBlockRecords();
  }, [clearSelectedBlockRecords, setBlockInspectorOpen, setSelectedBlock, setSelectedRunRecord]);

  const refreshLatestAutoRunSummary = useCallback(
    async (projectRoot = projectState.selectedProject?.rootPath, canvasId = projectState.selectedCanvasId) => {
      if (!bridge || !projectRoot) {
        setAutoRunState(null);
        return null;
      }
      const summary = await bridge.getLatestAutoRunSummary({ projectRoot, canvasId });
      setAutoRunState(summary);
      return summary;
    },
    [projectState.selectedCanvasId, projectState.selectedProject?.rootPath, setAutoRunState]
  );

  const openProject = useCallback(
    async (project: DesktopProjectSummary, canvasId?: string | null) => {
      const nextCanvasId = resolveProjectCanvasId(project, canvasId);
      clearSelectionForCanvasChange();
      await projectState.loadProject(project, nextCanvasId);
      await refreshLatestAutoRunSummary(project.rootPath, nextCanvasId);
    },
    [clearSelectionForCanvasChange, projectState.loadProject, refreshLatestAutoRunSummary]
  );

  const reloadCurrentCanvas = useCallback(async () => {
    if (!projectState.selectedProject) {
      return;
    }
    await openProject(projectState.selectedProject, projectState.selectedCanvasId);
  }, [openProject, projectState.selectedCanvasId, projectState.selectedProject]);

  const createTaskCanvas = useCallback(
    async (project: DesktopProjectSummary) => {
      if (!bridge) {
        return null;
      }
      const canvas = await bridge.createTaskCanvas(project.rootPath);
      const refreshed = await projectState.refreshProjectSummary(project.rootPath, canvas.canvasId);
      await openProject(refreshed ?? project, canvas.canvasId);
      return canvas;
    },
    [openProject, projectState.refreshProjectSummary]
  );

  const deleteTaskCanvas = useCallback(
    async (project: DesktopProjectSummary, canvasId: string) => {
      if (!bridge) {
        return;
      }
      const canvases = await bridge.removeTaskCanvas(project.rootPath, canvasId);
      const nextCanvasId = canvases[0]?.canvasId ?? null;
      const refreshed = await projectState.refreshProjectSummary(project.rootPath, nextCanvasId);
      if (projectState.selectedProject?.projectId === project.projectId && refreshed) {
        await openProject(refreshed, nextCanvasId);
      }
    },
    [openProject, projectState.refreshProjectSummary, projectState.selectedProject?.projectId]
  );

  useEffect(() => {
    clearSelectionForCanvasChange();
  }, [clearSelectionForCanvasChange, projectState.selectedCanvasId, projectState.selectedProject?.projectId]);

  useEffect(() => {
    void refreshLatestAutoRunSummary();
  }, [refreshLatestAutoRunSummary]);

  return {
    ...projectState,
    clearSelectionForCanvasChange,
    createTaskCanvas,
    deleteTaskCanvas,
    openProject,
    refreshLatestAutoRunSummary,
    reloadCurrentCanvas
  };
}
