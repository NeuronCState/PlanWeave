import type { CSSProperties, Dispatch, DragEvent, MouseEvent, PointerEvent, SetStateAction } from "react";
import type {
  Connection,
  Edge,
  Node,
  OnEdgesChange,
  OnNodesChange,
  ReactFlowInstance
} from "@xyflow/react";
import type {
  DesktopAutoRunState,
  DesktopGraphViewModel,
  DesktopProjectSummary,
  DesktopReviewPipeline,
  DesktopReviewPipelineStepInput,
  DesktopSearchResult,
  DesktopStatistics,
  DesktopTaskDraft,
  DesktopTaskDraftMode,
  DesktopTodoGroups
} from "@planweave/runtime";
import { RotateCcwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { createTranslator, Language } from "../i18n";
import type { AppNodeTypes } from "../graph/flowModel";
import type { AppFlowNode, AppView, AutoRunScopeMode, DesktopUiSettings, NotificationItem } from "../types";
import { GraphView } from "./GraphView";
import { NewTaskView } from "./NewTaskView";
import { NotificationsView } from "./NotificationsView";
import { ReviewPipelineView } from "./ReviewPipelineView";
import { SearchView } from "./SearchView";
import { SettingsView } from "./SettingsView";
import { StatisticsView } from "./StatisticsView";
import { TodoView } from "./TodoView";

type WorkspaceTabsProps = {
  activeView: AppView;
  autoRunControlStyle: CSSProperties;
  autoRunScopeMode: AutoRunScopeMode;
  autoRunState: DesktopAutoRunState | null;
  confirmTaskDraft: () => Promise<void>;
  dirtyPromptRefs: string[];
  edges: Edge[];
  generateTaskDraft: () => Promise<void>;
  graph: DesktopGraphViewModel | null;
  handleAutoRunClick: () => Promise<void>;
  handleBlockSelect: (ref: string) => Promise<void>;
  handleConnect: (connection: Connection) => Promise<void>;
  handleEdgesDelete: (deletedEdges: Edge[]) => Promise<void>;
  handleGraphDragOver: (event: DragEvent) => void;
  handleGraphDrop: (event: DragEvent) => void;
  handleOpenProject: () => Promise<void>;
  handleOpenRunRecord: (recordId: string | null | undefined) => Promise<void>;
  handleSearchResultOpen: (result: DesktopSearchResult) => void;
  language: Language;
  miniRunPanelOpen: boolean;
  moveAutoRunControl: (event: PointerEvent<HTMLButtonElement>) => void;
  moveReviewStep: (index: number, direction: -1 | 1) => void;
  newTaskMode: DesktopTaskDraftMode;
  newTaskTargetId: string | null;
  newTaskText: string;
  nodeTypes: AppNodeTypes;
  nodes: AppFlowNode[];
  notificationItems: NotificationItem[];
  onEdgesChange: OnEdgesChange<Edge>;
  onNodeDragStop: (event: MouseEvent, node: Node) => Promise<void>;
  onNodesChange: OnNodesChange<AppFlowNode>;
  refreshPackageFiles: () => Promise<void>;
  removeReviewStep: (index: number) => void;
  resetLayout: () => Promise<void>;
  reviewDefaultCyclesDraft: number;
  reviewDraft: DesktopReviewPipelineStepInput[];
  reviewPipeline: DesktopReviewPipeline | null;
  reviewTaskId: string | null;
  saveReviewPipeline: () => Promise<void>;
  searchQuery: string;
  searchResults: DesktopSearchResult[];
  selectedBlockPresent: boolean;
  selectedProject: DesktopProjectSummary | null;
  selectedTaskPanelId: string | null;
  setActiveView: Dispatch<SetStateAction<AppView>>;
  setAutoRunScopeMode: Dispatch<SetStateAction<AutoRunScopeMode>>;
  setFlowInstance: Dispatch<SetStateAction<ReactFlowInstance<AppFlowNode, Edge> | null>>;
  setMiniRunPanelOpen: Dispatch<SetStateAction<boolean>>;
  setNewTaskMode: Dispatch<SetStateAction<DesktopTaskDraftMode>>;
  setNewTaskTargetId: Dispatch<SetStateAction<string | null>>;
  setNewTaskText: Dispatch<SetStateAction<string>>;
  setProjectPath: Dispatch<SetStateAction<string>>;
  setReviewDefaultCyclesDraft: Dispatch<SetStateAction<number>>;
  setReviewTaskId: Dispatch<SetStateAction<string | null>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  settings: DesktopUiSettings;
  startAutoRunControlDrag: (event: PointerEvent<HTMLButtonElement>) => void;
  statistics: DesktopStatistics | null;
  stopAutoRunClick: () => Promise<void>;
  stopAutoRunControlDrag: (event: PointerEvent<HTMLButtonElement>) => void;
  t: ReturnType<typeof createTranslator>;
  taskDraft: DesktopTaskDraft | null;
  todoGroups: DesktopTodoGroups | null;
  updateReviewStep: (index: number, patch: Partial<DesktopReviewPipelineStepInput>) => void;
  updateSettings: (patch: Partial<DesktopUiSettings>) => void;
  visibleTaskIds: Set<string>;
  visibleTasks: DesktopGraphViewModel["tasks"] | undefined;
  addReviewStep: () => void;
};

export function WorkspaceTabs(props: WorkspaceTabsProps) {
  const {
    activeView,
    dirtyPromptRefs,
    graph,
    refreshPackageFiles,
    resetLayout,
    setActiveView,
    t
  } = props;

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <Tabs className="min-h-0 flex-1" value={activeView} onValueChange={(value) => setActiveView(value as AppView)}>
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
          <TabsList>
            <TabsTrigger value="graph">{t("graph")}</TabsTrigger>
            <TabsTrigger value="review-pipeline">{t("reviewPipeline")}</TabsTrigger>
            <TabsTrigger value="todo">{t("todo")}</TabsTrigger>
            <TabsTrigger value="statistics">{t("statistics")}</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            {dirtyPromptRefs.length || graph?.dirtyPromptRefs.length ? <Badge variant="destructive">{t("dirtyPrompts")}</Badge> : null}
            <Button variant="outline" onClick={() => void refreshPackageFiles()}>
              <RotateCcwIcon data-icon="inline-start" />
              {dirtyPromptRefs.length ? `${t("dirtyPrompts")} ${dirtyPromptRefs.length}` : t("refreshFiles")}
            </Button>
            <Button variant="outline" onClick={resetLayout}>
              <RotateCcwIcon data-icon="inline-start" />
              {t("resetLayout")}
            </Button>
          </div>
        </div>
        <TabsContent className="min-h-0 p-4" value="new-task">
          <NewTaskView {...props} />
        </TabsContent>
        <TabsContent className="min-h-0" value="graph">
          <GraphView {...props} />
        </TabsContent>
        <TabsContent className="min-h-0 p-4" value="review-pipeline">
          <ReviewPipelineView {...props} />
        </TabsContent>
        <TabsContent className="min-h-0 p-4" value="todo">
          <TodoView {...props} />
        </TabsContent>
        <TabsContent className="p-4" value="statistics">
          <StatisticsView {...props} />
        </TabsContent>
        <TabsContent className="p-4" value="search">
          <SearchView {...props} />
        </TabsContent>
        <TabsContent className="p-4" value="notifications">
          <NotificationsView {...props} />
        </TabsContent>
        <TabsContent className="min-h-0 overflow-auto p-4" value="settings">
          <SettingsView {...props} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
