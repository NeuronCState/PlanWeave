import { useState, type Dispatch, type SetStateAction } from "react";
import {
  PanelLeftCloseIcon,
  RotateCcwIcon
} from "lucide-react";
import type { DesktopGraphViewModel, DesktopProjectSummary } from "@planweave-ai/runtime";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { createTranslator } from "../i18n";
import type { AppView, NotificationItem } from "../types";
import { HistoryNavigationButtons } from "../components/HistoryNavigationButtons";
import { ProjectTree } from "./ProjectTree";
import { SidebarNav } from "./SidebarNav";

type ProjectSidebarProps = {
  activeView: AppView;
  collapsed: boolean;
  expandedProjectId: string | null;
  graph: DesktopGraphViewModel | null;
  handleDeleteProject: (project: DesktopProjectSummary) => Promise<void>;
  handleDeleteTaskCanvas: (project: DesktopProjectSummary, canvasId: string) => Promise<void>;
  handleDeleteTaskNode: (taskId: string) => Promise<void>;
  handleOpenProject: () => Promise<void>;
  handleProjectNewGraph: (project: DesktopProjectSummary) => Promise<void>;
  handleRevealProject: (project: DesktopProjectSummary) => Promise<void>;
  handleTaskPanelSelect: (taskId: string | null) => void;
  loadProject: (project: DesktopProjectSummary, canvasId?: string | null) => Promise<void>;
  notificationItems: NotificationItem[];
  onToggleSidebar: () => void;
  onTogglePinnedProject: (projectId: string) => void;
  pinnedProjectIds: Set<string>;
  projects: DesktopProjectSummary[];
  resetLayout: () => Promise<void>;
  selectedProject: DesktopProjectSummary | null;
  selectedCanvasId: string | null;
  selectedTaskPanelId: string | null;
  setActiveView: Dispatch<SetStateAction<AppView>>;
  t: ReturnType<typeof createTranslator>;
};

export function ProjectSidebar({
  activeView,
  collapsed,
  expandedProjectId,
  graph,
  handleDeleteProject,
  handleDeleteTaskCanvas,
  handleDeleteTaskNode,
  handleOpenProject,
  handleProjectNewGraph,
  handleRevealProject,
  handleTaskPanelSelect,
  loadProject,
  notificationItems,
  onToggleSidebar,
  onTogglePinnedProject,
  pinnedProjectIds,
  projects,
  resetLayout,
  selectedProject,
  selectedCanvasId,
  selectedTaskPanelId,
  setActiveView,
  t
}: ProjectSidebarProps) {
  const [collapsedProjectIds, setCollapsedProjectIds] = useState<Set<string>>(() => new Set());
  const [collapsedCanvasIds, setCollapsedCanvasIds] = useState<Set<string>>(() => new Set());

  if (collapsed) {
    return null;
  }

  const toggleProject = (projectId: string) => {
    setCollapsedProjectIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const expandProject = (projectId: string) => {
    setCollapsedProjectIds((current) => {
      const next = new Set(current);
      next.delete(projectId);
      return next;
    });
  };

  const toggleCanvas = (canvasId: string) => {
    setCollapsedCanvasIds((current) => {
      const next = new Set(current);
      if (next.has(canvasId)) {
        next.delete(canvasId);
      } else {
        next.add(canvasId);
      }
      return next;
    });
  };

  const expandCanvas = (canvasId: string) => {
    setCollapsedCanvasIds((current) => {
      const next = new Set(current);
      next.delete(canvasId);
      return next;
    });
  };

  const handleProjectSelect = (project: DesktopProjectSummary) => {
    void loadProject(project).then(() => setActiveView("canvas-map"));
  };

  const handleCanvasSelect = (project: DesktopProjectSummary, canvasId: string) => {
    void loadProject(project, canvasId).then(() => handleTaskPanelSelect(null));
  };

  const handleProjectToggle = (project: DesktopProjectSummary, isSelectedProject: boolean) => {
    if (!isSelectedProject) {
      expandProject(project.projectId);
      void loadProject(project);
      return;
    }
    toggleProject(project.projectId);
  };

  const handleCanvasToggle = (project: DesktopProjectSummary, canvasId: string, isGraphCanvas: boolean) => {
    if (!isGraphCanvas) {
      expandCanvas(canvasId);
      void loadProject(project, canvasId);
      return;
    }
    toggleCanvas(canvasId);
  };

  return (
    <aside className="flex w-[280px] shrink-0 flex-col overflow-hidden border-r bg-sidebar">
      <div className="app-drag-region flex h-11 shrink-0 items-center border-b px-3 pl-[124px]">
        <div className="app-no-drag flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label={t("collapseSidebar")} onClick={onToggleSidebar}>
            <PanelLeftCloseIcon data-icon="inline-start" />
          </Button>
          <HistoryNavigationButtons t={t} />
        </div>
      </div>
      <SidebarNav
        activeView={activeView}
        canOpenCanvasMap={selectedProject !== null}
        notificationItems={notificationItems}
        onSelectView={setActiveView}
        t={t}
      />
      <ProjectTree
        collapsedCanvasIds={collapsedCanvasIds}
        collapsedProjectIds={collapsedProjectIds}
        expandedProjectId={expandedProjectId}
        graph={graph}
        handleDeleteProject={handleDeleteProject}
        handleDeleteTaskCanvas={handleDeleteTaskCanvas}
        handleDeleteTaskNode={handleDeleteTaskNode}
        handleOpenProject={handleOpenProject}
        handleProjectNewGraph={handleProjectNewGraph}
        handleRevealProject={handleRevealProject}
        handleTaskPanelSelect={handleTaskPanelSelect}
        onCanvasSelect={handleCanvasSelect}
        onCanvasToggle={handleCanvasToggle}
        onProjectSelect={handleProjectSelect}
        onProjectToggle={handleProjectToggle}
        onTogglePinnedProject={onTogglePinnedProject}
        pinnedProjectIds={pinnedProjectIds}
        projects={projects}
        selectedCanvasId={selectedCanvasId}
        selectedProject={selectedProject}
        selectedTaskPanelId={selectedTaskPanelId}
        t={t}
      />
      <Separator />
      <div className="flex items-center gap-2 p-3">
        <Button className="flex-1 justify-start" variant="ghost" onClick={() => void resetLayout()}>
          <RotateCcwIcon data-icon="inline-start" />
          {t("resetLayout")}
        </Button>
      </div>
    </aside>
  );
}
