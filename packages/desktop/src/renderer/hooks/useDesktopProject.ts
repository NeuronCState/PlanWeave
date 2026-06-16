import { useCallback, useEffect, useState } from "react";
import type {
  DesktopGraphViewModel,
  DesktopLayout,
  DesktopProjectExecutionPlan,
  DesktopProjectSummary,
  DesktopStatistics,
  DesktopTodoGroups,
  ProjectPromptPolicy
} from "@planweave-ai/runtime";
import { bridge, desktopCanvasReference } from "../bridge";
import type { DesktopUiSettings } from "../types";

export type UseDesktopProjectArgs = {
  setError: (message: string | null) => void;
  setSelectedTaskPanelId: (taskId: string | null) => void;
  updateSettings: (patch: Partial<DesktopUiSettings>) => void;
};

export function resolveProjectCanvasId(project: DesktopProjectSummary, requestedCanvasId?: string | null): string | null {
  if (requestedCanvasId !== undefined) {
    return requestedCanvasId;
  }
  if (project.activeCanvasId && project.taskCanvases.some((canvas) => canvas.canvasId === project.activeCanvasId)) {
    return project.activeCanvasId;
  }
  return project.taskCanvases[0]?.canvasId ?? null;
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

export function useDesktopProject({
  setError,
  setSelectedTaskPanelId,
  updateSettings
}: UseDesktopProjectArgs) {
  const [projects, setProjects] = useState<DesktopProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<DesktopProjectSummary | null>(null);
  const [selectedCanvasId, setSelectedCanvasId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [graph, setGraph] = useState<DesktopGraphViewModel | null>(null);
  const [layout, setLayout] = useState<DesktopLayout | null>(null);
  const [todoGroups, setTodoGroups] = useState<DesktopTodoGroups | null>(null);
  const [executionPlan, setExecutionPlan] = useState<DesktopProjectExecutionPlan | null>(null);
  const [statistics, setStatistics] = useState<DesktopStatistics | null>(null);
  const [projectPromptMarkdown, setProjectPromptMarkdown] = useState<string | null>(null);
  const [projectPromptPolicy, setProjectPromptPolicy] = useState<ProjectPromptPolicy | null>(null);

  const loadProject = useCallback(
    async (project: DesktopProjectSummary, requestedCanvasId?: string | null) => {
      if (!bridge) {
        return;
      }
      const canvasId = resolveProjectCanvasId(project, requestedCanvasId);
      setSelectedProject(project);
      setSelectedCanvasId(canvasId);
      setExpandedProjectId(project.projectId);
      setSelectedTaskPanelId(null);
      setError(null);
      setGraph(null);
      setLayout(null);
      setTodoGroups(null);
      setExecutionPlan(null);
      setStatistics(null);
      setProjectPromptMarkdown(null);
      setProjectPromptPolicy(null);
      const canvasRef = desktopCanvasReference(project, canvasId);
      const errors: string[] = [];
      try {
        const snapshot = await bridge.getDesktopProjectSnapshot(canvasRef);
        setProjectPromptMarkdown(snapshot.projectPromptMarkdown);
        setProjectPromptPolicy(snapshot.projectPromptPolicy);
        setGraph(snapshot.graph);
        setLayout(snapshot.layout);
        setTodoGroups(snapshot.todoGroups);
        setExecutionPlan(snapshot.executionPlan);
        setStatistics(snapshot.statistics);
        errors.push(...snapshot.errors);
        if (snapshot.graph) {
          try {
            await bridge.refreshPackageFileChanges(canvasRef);
            await bridge.watchPackageFiles(canvasRef);
          } catch (caught) {
            errors.push(errorMessage(caught));
          }
        }
      } catch (caught) {
        errors.push(errorMessage(caught));
      }
      if (errors.length > 0) {
        setError(errors.join("\n"));
      }
      updateSettings({ runtimePath: project.workspaceRoot });
    },
    [setError, setSelectedTaskPanelId, updateSettings]
  );

  useEffect(() => {
    if (!bridge) {
      return;
    }
    bridge
      .listProjects()
      .then((items) => {
        setProjects(items);
        if (items[0]) {
          void loadProject(items[0]);
        }
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)));
  }, [loadProject, setError]);

  useEffect(() => {
  const projectRoot = selectedProject?.rootPath;
  const canvasId = selectedCanvasId;
    return () => {
      if (bridge && projectRoot) {
        void bridge.unwatchPackageFiles({ projectRoot, canvasId });
      }
    };
  }, [selectedCanvasId, selectedProject?.rootPath]);

  const refreshGraph = useCallback(async () => {
    if (!bridge || !selectedProject) {
      return;
    }
    const nextGraph = await bridge.getGraphViewModel(desktopCanvasReference(selectedProject, selectedCanvasId));
    setGraph(nextGraph);
  }, [selectedCanvasId, selectedProject]);

  const updateProjectPromptPolicy = useCallback(
    async (patch: Partial<ProjectPromptPolicy>) => {
      if (!bridge || !selectedProject) {
        return;
      }
      setProjectPromptPolicy(await bridge.updateProjectPromptPolicy(selectedProject.rootPath, patch));
    },
    [selectedProject]
  );

  const updateProjectPrompt = useCallback(
    async (markdown: string) => {
      if (!bridge || !selectedProject) {
        return;
      }
      setProjectPromptMarkdown(await bridge.updateProjectPrompt(selectedProject.rootPath, markdown));
    },
    [selectedProject]
  );

  const refreshProjectSummary = useCallback(
    async (projectRoot: string, canvasId?: string | null) => {
      if (!bridge) {
        return null;
      }
      const nextProjects = await bridge.listProjects();
      setProjects(nextProjects);
      const project = nextProjects.find((item) => item.rootPath === projectRoot) ?? null;
      if (project && selectedProject?.rootPath === projectRoot) {
        setSelectedProject(project);
        if (canvasId !== undefined) {
          setSelectedCanvasId(canvasId);
        }
      }
      return project;
    },
    [selectedProject?.rootPath]
  );

  const handleOpenProject = useCallback(async () => {
    if (!bridge) {
      return;
    }
    try {
      const selectedPath = await bridge.chooseProjectFolder();
      if (!selectedPath) {
        return;
      }
      const project = await bridge.initOrOpenProject(selectedPath);
      setProjects((items) => (items.some((item) => item.projectId === project.projectId) ? items : [...items, project]));
      await loadProject(project);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [loadProject, setError]);

  const removeProject = useCallback(
    async (project: DesktopProjectSummary) => {
      if (!bridge) {
        return;
      }
      await bridge.removeProject(project.projectId);
      const nextProjects = await bridge.listProjects();
      setProjects(nextProjects);
      if (selectedProject?.projectId !== project.projectId) {
        return;
      }
      const nextProject = nextProjects[0] ?? null;
      if (nextProject) {
        await loadProject(nextProject);
        return;
      }
      setSelectedProject(null);
      setSelectedCanvasId(null);
      setExpandedProjectId(null);
      setSelectedTaskPanelId(null);
      setGraph(null);
      setLayout(null);
      setTodoGroups(null);
      setExecutionPlan(null);
      setStatistics(null);
      setProjectPromptMarkdown(null);
      setProjectPromptPolicy(null);
    },
    [loadProject, selectedProject?.projectId, setSelectedTaskPanelId]
  );

  return {
    expandedProjectId,
    executionPlan,
    graph,
    handleOpenProject,
    layout,
    loadProject,
    projects,
    projectPromptMarkdown,
    projectPromptPolicy,
    refreshProjectSummary,
    refreshGraph,
    removeProject,
    selectedCanvasId,
    selectedProject,
    setLayout,
    statistics,
    todoGroups,
    updateProjectPrompt,
    updateProjectPromptPolicy
  };
}
