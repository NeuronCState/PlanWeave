import { useCallback, useEffect } from "react";
import type { DesktopAutoRunState, DesktopBlockDetail, DesktopProjectSummary, DesktopRunRecord } from "@planweave-ai/runtime";
import { bridge, desktopCanvasReference } from "../bridge";
import type { Language } from "../i18n";
import type { AppView } from "../types";
import { resolveProjectCanvasId, useDesktopProject } from "./useDesktopProject";

type DesktopProjectState = ReturnType<typeof useDesktopProject>;

type UseDesktopProjectSessionArgs = {
  clearSelectedBlockRecords: () => void;
  language: Language;
  projectState: DesktopProjectState;
  requestTaskFocus: (taskId: string | null) => void;
  selectBlock: (ref: string, canvasId?: string | null) => Promise<void>;
  setActiveView: (view: AppView) => void;
  setAutoRunState: (state: DesktopAutoRunState | null) => void;
  setBlockInspectorOpen: (open: boolean) => void;
  setError: (message: string | null) => void;
  setSelectedBlock: (block: DesktopBlockDetail | null) => void;
  setSelectedTaskPanelId: (taskId: string | null) => void;
  setSelectedRunRecord: (record: DesktopRunRecord | null) => void;
};

export function useDesktopProjectSession({
  clearSelectedBlockRecords,
  language,
  projectState,
  requestTaskFocus,
  selectBlock,
  setActiveView,
  setAutoRunState,
  setBlockInspectorOpen,
  setError,
  setSelectedBlock,
  setSelectedTaskPanelId,
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

  const selectTaskPanel = useCallback(
    (taskId: string | null) => {
      setSelectedTaskPanelId(taskId);
      setActiveView("graph");
      requestTaskFocus(taskId);
    },
    [requestTaskFocus, setActiveView, setSelectedTaskPanelId]
  );

  const openTaskInspector = useCallback(
    async (taskId: string, canvasIdOverride?: string | null) => {
      const canvasId = canvasIdOverride === undefined ? projectState.selectedCanvasId : canvasIdOverride;
      try {
        selectTaskPanel(taskId);
        if (!bridge || !projectState.selectedProject) {
          return;
        }
        await bridge.openTaskInspectorWindow({
          taskId,
          canvas: desktopCanvasReference(projectState.selectedProject, canvasId),
          language
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    },
    [language, projectState.selectedCanvasId, projectState.selectedProject, selectTaskPanel, setError]
  );

  const openBlockInspector = useCallback(
    async (ref: string, canvasIdOverride?: string | null) => {
      const canvasId = canvasIdOverride === undefined ? projectState.selectedCanvasId : canvasIdOverride;
      try {
        await selectBlock(ref, canvasId);
        if (!bridge || !projectState.selectedProject) {
          return;
        }
        await bridge.openBlockInspectorWindow({
          blockRef: ref,
          canvas: desktopCanvasReference(projectState.selectedProject, canvasId),
          language
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    },
    [language, projectState.selectedCanvasId, projectState.selectedProject, selectBlock, setError]
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
    openBlockInspector,
    openProject,
    openTaskInspector,
    refreshLatestAutoRunSummary,
    reloadCurrentCanvas,
    selectTaskPanel
  };
}
