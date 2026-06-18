import { useCallback } from "react";
import type { DesktopProjectSummary } from "@planweave-ai/runtime";
import { bridge } from "../bridge";
import type { createTranslator } from "../i18n";
import type { AppView } from "../types";

type UseDesktopProjectActionsArgs = {
  createTaskCanvas: (project: DesktopProjectSummary) => Promise<unknown>;
  deleteTaskCanvas: (project: DesktopProjectSummary, canvasId: string) => Promise<void>;
  removeProject: (project: DesktopProjectSummary) => Promise<void>;
  setActiveView: (view: AppView) => void;
  setError: (message: string | null) => void;
  t: ReturnType<typeof createTranslator>;
};

export function useDesktopProjectActions({
  createTaskCanvas,
  deleteTaskCanvas,
  removeProject,
  setActiveView,
  setError,
  t
}: UseDesktopProjectActionsArgs) {
  const handleProjectNewGraph = useCallback(
    async (project: DesktopProjectSummary) => {
      if (!bridge) {
        setError(t("bridgeUnavailable"));
        return;
      }
      try {
        await createTaskCanvas(project);
        setActiveView("new-task");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    },
    [createTaskCanvas, setActiveView, setError, t]
  );

  const handleRevealProject = useCallback(
    async (project: DesktopProjectSummary) => {
      if (!bridge) {
        setError(t("bridgeUnavailable"));
        return;
      }
      try {
        await bridge.revealProjectInFinder(project.rootPath);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    },
    [setError, t]
  );

  const handleRevealPathInFinder = useCallback(
    async (path: string | null | undefined) => {
      if (!bridge || !path) {
        return;
      }
      try {
        await bridge.revealPathInFinder(path);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    },
    [setError]
  );

  const handleDeleteProject = useCallback(
    async (project: DesktopProjectSummary) => {
      if (!window.confirm(t("deleteProjectConfirm"))) {
        return;
      }
      try {
        await removeProject(project);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    },
    [removeProject, setError, t]
  );

  const handleDeleteTaskCanvas = useCallback(
    async (project: DesktopProjectSummary, canvasId: string) => {
      if (!bridge) {
        return;
      }
      if (!window.confirm(t("deleteTaskCanvasConfirm"))) {
        return;
      }
      try {
        await deleteTaskCanvas(project, canvasId);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    },
    [deleteTaskCanvas, setError, t]
  );

  return {
    handleDeleteProject,
    handleDeleteTaskCanvas,
    handleProjectNewGraph,
    handleRevealPathInFinder,
    handleRevealProject
  };
}
