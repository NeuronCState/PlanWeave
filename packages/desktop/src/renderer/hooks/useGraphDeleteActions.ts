import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { DesktopBlockDetail, DesktopProjectSummary, DesktopRunRecord } from "@planweave/runtime";
import { bridge } from "../bridge";

type UseGraphDeleteActionsArgs = {
  clearSelectedBlockRecords: () => void;
  deleteBlockConfirm: string;
  deleteTaskConfirm: string;
  loadProject: (project: DesktopProjectSummary, canvasId?: string | null) => Promise<void>;
  refreshGraph: () => Promise<void>;
  selectedCanvasId: string | null;
  selectedBlock: DesktopBlockDetail | null;
  selectedProject: DesktopProjectSummary | null;
  selectedTaskPanelId: string | null;
  setBlockInspectorOpen: Dispatch<SetStateAction<boolean>>;
  setError: (message: string | null) => void;
  setSelectedBlock: Dispatch<SetStateAction<DesktopBlockDetail | null>>;
  setSelectedRunRecord: Dispatch<SetStateAction<DesktopRunRecord | null>>;
  setSelectedTaskPanelId: Dispatch<SetStateAction<string | null>>;
};

export function useGraphDeleteActions({
  clearSelectedBlockRecords,
  deleteBlockConfirm,
  deleteTaskConfirm,
  loadProject,
  refreshGraph,
  selectedCanvasId,
  selectedBlock,
  selectedProject,
  selectedTaskPanelId,
  setBlockInspectorOpen,
  setError,
  setSelectedBlock,
  setSelectedRunRecord,
  setSelectedTaskPanelId
}: UseGraphDeleteActionsArgs) {
  const clearBlockSelection = useCallback(() => {
    setSelectedBlock(null);
    setSelectedRunRecord(null);
    setBlockInspectorOpen(false);
    clearSelectedBlockRecords();
  }, [clearSelectedBlockRecords, setBlockInspectorOpen, setSelectedBlock, setSelectedRunRecord]);

  const handleDeleteTaskNode = useCallback(
    async (taskId: string) => {
      if (!bridge || !selectedProject || !window.confirm(deleteTaskConfirm)) {
        return;
      }
      try {
        const result = await bridge.removeTaskNode(selectedProject.rootPath, selectedCanvasId, taskId);
        if (!result.ok) {
          setError(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
          return;
        }
        if (selectedTaskPanelId === taskId || selectedBlock?.taskId === taskId) {
          setSelectedTaskPanelId(null);
          clearBlockSelection();
        }
        await loadProject(selectedProject, selectedCanvasId);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    },
    [clearBlockSelection, deleteTaskConfirm, loadProject, selectedBlock, selectedCanvasId, selectedProject, selectedTaskPanelId, setError, setSelectedTaskPanelId]
  );

  const handleDeleteBlock = useCallback(
    async (ref: string) => {
      if (!bridge || !selectedProject || !window.confirm(deleteBlockConfirm)) {
        return;
      }
      try {
        const result = await bridge.removeBlock(selectedProject.rootPath, selectedCanvasId, ref);
        if (!result.ok) {
          setError(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
          return;
        }
        if (selectedBlock?.ref === ref) {
          clearBlockSelection();
        }
        await refreshGraph();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    },
    [clearBlockSelection, deleteBlockConfirm, refreshGraph, selectedBlock, selectedCanvasId, selectedProject, setError]
  );

  return { handleDeleteBlock, handleDeleteTaskNode };
}
