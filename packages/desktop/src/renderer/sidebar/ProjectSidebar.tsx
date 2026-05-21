import type { Dispatch, SetStateAction } from "react";
import { BellIcon, ChartNoAxesColumnIncreasingIcon, FilePlus2Icon, FolderOpenIcon, GitBranchIcon, LanguagesIcon, SearchIcon, SettingsIcon } from "lucide-react";
import type { DesktopGraphViewModel, DesktopProjectSummary } from "@planweave/runtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { createTranslator, Language } from "../i18n";
import type { AppView, DesktopUiSettings, NotificationItem } from "../types";
import { statusVariant } from "../viewHelpers";

type ProjectSidebarProps = {
  activeView: AppView;
  expandedProjectId: string | null;
  graph: DesktopGraphViewModel | null;
  handleOpenProject: () => Promise<void>;
  handleTaskPanelSelect: (taskId: string | null) => void;
  language: Language;
  loadProject: (project: DesktopProjectSummary) => Promise<void>;
  notificationItems: NotificationItem[];
  projectPath: string;
  projects: DesktopProjectSummary[];
  selectedProject: DesktopProjectSummary | null;
  selectedTaskPanelId: string | null;
  setActiveView: Dispatch<SetStateAction<AppView>>;
  setProjectPath: Dispatch<SetStateAction<string>>;
  t: ReturnType<typeof createTranslator>;
  updateSettings: (patch: Partial<DesktopUiSettings>) => void;
};

export function ProjectSidebar({
  activeView,
  expandedProjectId,
  graph,
  handleOpenProject,
  handleTaskPanelSelect,
  language,
  loadProject,
  notificationItems,
  projectPath,
  projects,
  selectedProject,
  selectedTaskPanelId,
  setActiveView,
  setProjectPath,
  t,
  updateSettings
}: ProjectSidebarProps) {
  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r bg-sidebar">
      <nav className="flex flex-col gap-1 p-3 pt-4">
        <Button className="justify-start" variant={activeView === "new-task" ? "secondary" : "ghost"} onClick={() => setActiveView("new-task")}>
          <FilePlus2Icon data-icon="inline-start" />
          {t("newTask")}
        </Button>
        <Button className="justify-start" variant={activeView === "statistics" ? "secondary" : "ghost"} onClick={() => setActiveView("statistics")}>
          <ChartNoAxesColumnIncreasingIcon data-icon="inline-start" />
          {t("statistics")}
        </Button>
        <Button className="justify-start" variant={activeView === "search" ? "secondary" : "ghost"} onClick={() => setActiveView("search")}>
          <SearchIcon data-icon="inline-start" />
          {t("search")}
        </Button>
        <Button className="justify-start" variant={activeView === "notifications" ? "secondary" : "ghost"} onClick={() => setActiveView("notifications")}>
          <BellIcon data-icon="inline-start" />
          {t("notifications")}
          {notificationItems.length > 0 ? <Badge variant="destructive">{notificationItems.length}</Badge> : null}
        </Button>
      </nav>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className="text-xs font-medium text-muted-foreground">{t("projects")}</div>
        <div className="flex gap-2">
          <Input aria-label={t("projectPath")} placeholder={t("projectPath")} value={projectPath} onChange={(event) => setProjectPath(event.target.value)} />
          <Button size="icon" variant="outline" onClick={handleOpenProject} aria-label={t("open")}>
            <FolderOpenIcon data-icon="inline-start" />
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-1 pr-2">
            {projects.length === 0 ? <div className="text-sm text-muted-foreground">{t("projectMissing")}</div> : null}
            {projects.map((project) => {
              const isSelectedProject = selectedProject?.projectId === project.projectId;
              const isExpandedProject = expandedProjectId === project.projectId && isSelectedProject;
              return (
                <div className="flex flex-col gap-1" key={project.projectId}>
                  <Button className="h-auto justify-start whitespace-normal py-2 text-left" variant={isSelectedProject ? "secondary" : "ghost"} onClick={() => void loadProject(project)}>
                    <GitBranchIcon data-icon="inline-start" />
                    <span className="min-w-0 truncate">{project.name}</span>
                  </Button>
                  {isExpandedProject && graph ? (
                    <div className="flex flex-col gap-1 pl-6">
                      <Button className="h-8 justify-start px-2 text-xs" variant={selectedTaskPanelId === null ? "secondary" : "ghost"} onClick={() => handleTaskPanelSelect(null)}>
                        {t("allTaskPanels")}
                      </Button>
                      {graph.tasks.map((task) => (
                        <Button
                          className="h-8 justify-between gap-2 px-2 text-xs"
                          key={task.taskId}
                          variant={selectedTaskPanelId === task.taskId ? "secondary" : "ghost"}
                          onClick={() => handleTaskPanelSelect(task.taskId)}
                        >
                          <span className="min-w-0 truncate">{task.title}</span>
                          <Badge variant={task.exceptions.length > 0 ? "destructive" : statusVariant[task.status]}>{task.taskId}</Badge>
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
      <Separator />
      <div className="flex items-center gap-2 p-3">
        <Select value={language} onValueChange={(value) => updateSettings({ language: value as Language })}>
          <SelectTrigger className="flex-1">
            <LanguagesIcon />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="system">{t("systemLanguage")}</SelectItem>
              <SelectItem value="zh-CN">简体中文</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button size="icon" variant="ghost" aria-label={t("settings")} onClick={() => setActiveView("settings")}>
          <SettingsIcon data-icon="inline-start" />
        </Button>
      </div>
    </aside>
  );
}
