import { useCallback, useState } from "react";
import type { DesktopProjectSummary, DesktopTaskDraft, DesktopTaskDraftMode } from "@planweave/runtime";
import { bridge } from "../bridge";
import type { AppView } from "../types";

type UseTaskDraftArgs = {
  loadProject: (project: DesktopProjectSummary, canvasId?: string | null) => Promise<void>;
  selectedCanvasId: string | null;
  selectedProject: DesktopProjectSummary | null;
  setActiveView: (view: AppView) => void;
  setError: (message: string | null) => void;
};

export function useTaskDraft({ loadProject, selectedCanvasId, selectedProject, setActiveView, setError }: UseTaskDraftArgs) {
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskMode, setNewTaskMode] = useState<DesktopTaskDraftMode>("task");
  const [newTaskTargetId, setNewTaskTargetId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<DesktopTaskDraft | null>(null);

  const generateTaskDraft = useCallback(async () => {
    if (!bridge || !selectedProject || !newTaskText.trim()) {
      return;
    }
    try {
      setTaskDraft(
        await bridge.createTaskDraft(selectedProject.rootPath, selectedCanvasId, {
          mode: newTaskMode,
          text: newTaskText,
          targetTaskId: newTaskTargetId
        })
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [newTaskMode, newTaskTargetId, newTaskText, selectedCanvasId, selectedProject, setError]);

  const confirmTaskDraft = useCallback(async () => {
    if (!bridge || !selectedProject || !taskDraft) {
      return;
      }
      try {
        for (const task of taskDraft.tasks) {
        const result = await bridge.addTaskNode(selectedProject.rootPath, selectedCanvasId, task);
        if (!result.ok) {
          setError(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
          return;
        }
      }
      for (const block of taskDraft.blocks) {
        const result = await bridge.addBlock(selectedProject.rootPath, selectedCanvasId, block);
        if (!result.ok) {
          setError(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
          return;
        }
      }
      setTaskDraft(null);
      setNewTaskText("");
      await loadProject(selectedProject, selectedCanvasId);
      setActiveView("graph");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [loadProject, selectedCanvasId, selectedProject, setActiveView, setError, taskDraft]);

  return {
    confirmTaskDraft,
    generateTaskDraft,
    newTaskMode,
    newTaskTargetId,
    newTaskText,
    setNewTaskMode,
    setNewTaskTargetId,
    setNewTaskText,
    taskDraft
  };
}
