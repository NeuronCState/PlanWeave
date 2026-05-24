import { useCallback, useEffect, useMemo, useState } from "react";
import type { DesktopGraphViewModel, DesktopTaskDetail } from "@planweave/runtime";
import { bridge } from "./bridge";
import { createTranslator, type Language } from "./i18n";
import { useDetectedAgents } from "./hooks/useDetectedAgents";
import { TaskInspector } from "./inspector/TaskInspector";

function supportedLanguage(value: string | null): Language {
  return value === "en" || value === "zh-CN" ? value : "zh-CN";
}

export function TaskInspectorWindow() {
  const search = window.location.search;
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const projectRoot = params.get("projectRoot") ?? "";
  const taskId = params.get("taskId") ?? "";
  const canvasId = params.get("canvasId");
  const language = supportedLanguage(params.get("language"));
  const t = useMemo(() => createTranslator(language), [language]);
  const { executorOptions } = useDetectedAgents();
  const [selectedTask, setSelectedTask] = useState<DesktopTaskDetail | null>(null);
  const [graph, setGraph] = useState<DesktopGraphViewModel | null>(null);
  const [error, setError] = useState<string | null>(bridge ? null : t("bridgeUnavailable"));
  const [draftDirty, setDraftDirty] = useState(false);

  const loadTask = useCallback(async () => {
    if (!bridge || !projectRoot || !taskId) {
      return;
    }
    const canvas = { projectRoot, canvasId };
    try {
      const [nextGraph, task] = await Promise.all([
        bridge.getGraphViewModel(canvas),
        bridge.getTaskDetail(canvas, taskId)
      ]);
      setGraph(nextGraph);
      setSelectedTask(task);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [canvasId, projectRoot, taskId]);

  useEffect(() => {
    void loadTask();
  }, [loadTask]);

  useEffect(() => {
    if (draftDirty) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      void loadTask();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [draftDirty, loadTask]);

  const saveSelectedTaskTitle = useCallback(async () => {
    if (!bridge || !projectRoot || !selectedTask) {
      return;
    }
    const result = await bridge.updateTaskTitle({ projectRoot, canvasId }, selectedTask.taskId, selectedTask.title);
    if (!result.ok) {
      setError(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
      return;
    }
    await loadTask();
  }, [canvasId, loadTask, projectRoot, selectedTask]);

  const saveSelectedTaskExecutor = useCallback(
    async (executorName: string | null) => {
      if (!bridge || !projectRoot || !selectedTask) {
        return;
      }
      const result = await bridge.updateTaskExecutor({ projectRoot, canvasId }, selectedTask.taskId, executorName);
      if (!result.ok) {
        setError(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
        return;
      }
      await loadTask();
    },
    [canvasId, loadTask, projectRoot, selectedTask]
  );

  const saveSelectedTaskPrompt = useCallback(async () => {
    if (!bridge || !projectRoot || !selectedTask) {
      return;
    }
    const result = await bridge.updateTaskPrompt({ projectRoot, canvasId }, selectedTask.taskId, selectedTask.promptMarkdown);
    if (!result.ok) {
      setError(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
      return;
    }
    await loadTask();
  }, [canvasId, loadTask, projectRoot, selectedTask]);

  return (
    <TaskInspector
      className="inset-0 h-screen w-screen min-w-0 rounded-none border-0 shadow-none ring-0"
      error={error}
      executorOptions={executorOptions}
      graph={graph}
      onClose={() => window.close()}
      onDraftDirtyChange={setDraftDirty}
      saveSelectedTaskExecutor={saveSelectedTaskExecutor}
      saveSelectedTaskPrompt={saveSelectedTaskPrompt}
      saveSelectedTaskTitle={saveSelectedTaskTitle}
      selectedTask={selectedTask}
      setSelectedTask={setSelectedTask}
      t={t}
    />
  );
}
