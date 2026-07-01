import type { CSSProperties, Dispatch, DragEvent, MouseEvent, PointerEvent, Ref, SetStateAction } from "react";
import type {
  Connection,
  Edge,
  Node,
  OnEdgesChange,
  OnNodesChange,
  ReactFlowInstance
} from "@xyflow/react";
import type {
  DesktopAutoRunRetrospectiveSummary,
  DesktopAutoRunState,
  DesktopGraphViewModel,
  DesktopPackageFileSyncResult,
  DesktopProjectExecutionPlan,
  DesktopProjectSummary,
  DesktopReviewPipeline,
  DesktopReviewPipelineStepInput,
  DesktopSearchResult,
  DesktopSearchResultKind,
  DesktopStatistics,
  DesktopTaskDraft,
  DesktopTaskDraftMode,
  DesktopTodoGroups,
  ValidationIssue
} from "@planweave-ai/runtime";
import type { createTranslator, Language } from "../i18n";
import type { DesktopSearchCanvasScope, DesktopSearchStatus } from "../hooks/useDesktopSearch";
import type { AppEdgeTypes, AppNodeTypes } from "../graph/flowModel";
import type { AutoRunNextActionDescriptor } from "../run/autoRunNextActions";
import type { AppFlowNode, AppView, AutoRunScopeMode, DesktopSettingsUpdate, DesktopUiSettings, NotificationItem } from "../types";
import { createAutoRunGraphViewProps } from "../controllers/AutoRunController";
import { createGraphWorkspaceViewProps, createTodoViewProps } from "../controllers/GraphWorkspaceController";
import { createSearchViewProps } from "../controllers/SearchController";
import { createWorkspaceTabsViewProps } from "../controllers/WorkspaceTabsController";
import { CanvasMapView } from "./CanvasMapView";
import { GraphView } from "./GraphView";
import { NewTaskView } from "./NewTaskView";
import { NotificationsView } from "./NotificationsView";
import { ReviewPipelineView } from "./ReviewPipelineView";
import { SearchView } from "./SearchView";
import { StatisticsView } from "./StatisticsView";
import { TodoView } from "./TodoView";

export type WorkspaceTabsViewProps = {
  activeView: AppView;
  autoRunControlRef: Ref<HTMLDivElement>;
  autoRunControlStyle: CSSProperties;
  autoRunNextAction: AutoRunNextActionDescriptor | null;
  autoRunRetrospective: DesktopAutoRunRetrospectiveSummary | null;
  autoRunScopeMode: AutoRunScopeMode;
  autoRunState: DesktopAutoRunState | null;
  confirmTaskDraft: () => Promise<void>;
  edges: Edge[];
  fileSyncResult: DesktopPackageFileSyncResult | null;
  projectDiagnostics: ValidationIssue[];
  generateTaskDraft: () => Promise<void>;
  graph: DesktopGraphViewModel | null;
  executionPlan: DesktopProjectExecutionPlan | null;
  handleAutoRunClick: () => Promise<void>;
  handleAutoRunNextAction: (action: AutoRunNextActionDescriptor) => Promise<void>;
  handleOpenBlockInspector: (ref: string, canvasId?: string | null) => Promise<void>;
  handleConnect: (connection: Connection) => Promise<void>;
  handleEdgesDelete: (deletedEdges: Edge[]) => Promise<void>;
  handleReconnectEdge: (oldEdge: Edge, connection: Connection) => Promise<void>;
  handleGraphDragOver: (event: DragEvent) => void;
  handleGraphDrop: (event: DragEvent) => void;
  handleOpenProject: () => Promise<void>;
  handleOpenRunRecord: (recordId: string | null | undefined, canvasId?: string | null) => Promise<void>;
  handleRedoGraph: () => Promise<void>;
  handleRevealPathInFinder: (path: string | null | undefined) => Promise<void>;
  resetRuntimeStateClick: () => Promise<void>;
  handleSearchResultOpen: (result: DesktopSearchResult) => Promise<void>;
  handleUndoGraph: () => Promise<void>;
  language: Language;
  loadProject: (project: DesktopProjectSummary, canvasId?: string | null) => Promise<void>;
  miniRunPanelOpen: boolean;
  moveAutoRunControl: (event: PointerEvent<HTMLButtonElement>) => void;
  moveReviewStep: (index: number, direction: -1 | 1) => void;
  newTaskMode: DesktopTaskDraftMode;
  newTaskTargetId: string | null;
  newTaskText: string;
  edgeTypes: AppEdgeTypes;
  nodeTypes: AppNodeTypes;
  nodes: AppFlowNode[];
  notificationItems: NotificationItem[];
  onApplyLocalPromptConflicts: () => Promise<void>;
  onKeepLocalPromptConflicts: () => void;
  projectLoading: boolean;
  onMarkNotificationRead: (notificationId: string) => void;
  onAgentPromptCopied: () => void;
  onReloadPromptConflicts: () => Promise<void>;
  onEdgesChange: OnEdgesChange<Edge>;
  onNodeDragStop: (event: MouseEvent, node: Node) => Promise<void>;
  onNodesChange: OnNodesChange<AppFlowNode>;
  onTaskPanelSelect: (taskId: string | null) => void;
  refreshPackageFiles: () => Promise<void>;
  removeReviewStep: (index: number) => void;
  reviewDefaultCyclesDraft: number;
  reviewDraft: DesktopReviewPipelineStepInput[];
  reviewPipeline: DesktopReviewPipeline | null;
  reviewTaskId: string | null;
  saveReviewPipeline: () => Promise<void>;
  searchCanvasScope: DesktopSearchCanvasScope;
  searchQuery: string;
  searchResultKinds: DesktopSearchResultKind[];
  searchResults: DesktopSearchResult[];
  searchStatus: DesktopSearchStatus;
  selectedBlockPresent: boolean;
  selectedCanvasId: string | null;
  selectedProject: DesktopProjectSummary | null;
  selectedSearchResultKinds: DesktopSearchResultKind[];
  selectedTaskPanelId: string | null;
  setActiveView: Dispatch<SetStateAction<AppView>>;
  setError: (message: string | null) => void;
  setAutoRunScopeMode: Dispatch<SetStateAction<AutoRunScopeMode>>;
  setSearchCanvasScope: Dispatch<SetStateAction<DesktopSearchCanvasScope>>;
  setFlowInstance: Dispatch<SetStateAction<ReactFlowInstance<AppFlowNode, Edge> | null>>;
  setMiniRunPanelOpen: Dispatch<SetStateAction<boolean>>;
  setNewTaskMode: Dispatch<SetStateAction<DesktopTaskDraftMode>>;
  setNewTaskTargetId: Dispatch<SetStateAction<string | null>>;
  setNewTaskText: Dispatch<SetStateAction<string>>;
  setTaskDraft: Dispatch<SetStateAction<DesktopTaskDraft | null>>;
  setReviewDefaultCyclesDraft: Dispatch<SetStateAction<number>>;
  setReviewTaskId: Dispatch<SetStateAction<string | null>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setSearchResultKindEnabled: (kind: DesktopSearchResultKind, enabled: boolean) => void;
  settings: DesktopUiSettings;
  startAutoRunControlDrag: (event: PointerEvent<HTMLButtonElement>) => void;
  statistics: DesktopStatistics | null;
  stopAutoRunClick: () => Promise<void>;
  stopAutoRunControlDrag: (event: PointerEvent<HTMLButtonElement>) => void;
  t: ReturnType<typeof createTranslator>;
  taskDraft: DesktopTaskDraft | null;
  todoGroups: DesktopTodoGroups | null;
  updateReviewStep: (index: number, patch: Partial<DesktopReviewPipelineStepInput>) => void;
  updateSettings: (update: DesktopSettingsUpdate) => void;
  visibleTaskIds: Set<string>;
  visibleTasks: DesktopGraphViewModel["tasks"] | undefined;
  addReviewStep: () => void;
};

export type WorkspaceTabsShellProps = Pick<
  WorkspaceTabsViewProps,
  | "activeView"
  | "handleOpenProject"
  | "handleRevealPathInFinder"
  | "language"
  | "loadProject"
  | "projectLoading"
  | "selectedCanvasId"
  | "selectedProject"
  | "selectedTaskPanelId"
  | "setActiveView"
  | "setError"
  | "settings"
  | "t"
  | "updateSettings"
>;

export type WorkspaceTabsGraphWorkspaceProps = Pick<
  WorkspaceTabsViewProps,
  | "edges"
  | "edgeTypes"
  | "executionPlan"
  | "graph"
  | "handleConnect"
  | "handleEdgesDelete"
  | "handleGraphDragOver"
  | "handleGraphDrop"
  | "handleOpenBlockInspector"
  | "handleOpenRunRecord"
  | "handleReconnectEdge"
  | "handleRedoGraph"
  | "handleUndoGraph"
  | "nodeTypes"
  | "nodes"
  | "onAgentPromptCopied"
  | "onEdgesChange"
  | "onNodeDragStop"
  | "onNodesChange"
  | "onTaskPanelSelect"
  | "selectedBlockPresent"
  | "setFlowInstance"
  | "visibleTaskIds"
  | "visibleTasks"
>;

export type WorkspaceTabsAutoRunProps = Pick<
  WorkspaceTabsViewProps,
  | "autoRunControlRef"
  | "autoRunControlStyle"
  | "autoRunNextAction"
  | "autoRunRetrospective"
  | "autoRunScopeMode"
  | "autoRunState"
  | "handleAutoRunClick"
  | "handleAutoRunNextAction"
  | "miniRunPanelOpen"
  | "moveAutoRunControl"
  | "resetRuntimeStateClick"
  | "setAutoRunScopeMode"
  | "setMiniRunPanelOpen"
  | "startAutoRunControlDrag"
  | "stopAutoRunClick"
  | "stopAutoRunControlDrag"
>;

export type WorkspaceTabsFileSyncProps = Pick<WorkspaceTabsViewProps, "fileSyncResult" | "projectDiagnostics" | "refreshPackageFiles">;

export type WorkspaceTabsSearchProps = Pick<
  WorkspaceTabsViewProps,
  | "handleSearchResultOpen"
  | "searchCanvasScope"
  | "searchQuery"
  | "searchResultKinds"
  | "searchResults"
  | "searchStatus"
  | "selectedSearchResultKinds"
  | "setSearchCanvasScope"
  | "setSearchQuery"
  | "setSearchResultKindEnabled"
>;

export type WorkspaceTabsReviewProps = Pick<
  WorkspaceTabsViewProps,
  | "addReviewStep"
  | "moveReviewStep"
  | "removeReviewStep"
  | "reviewDefaultCyclesDraft"
  | "reviewDraft"
  | "reviewPipeline"
  | "reviewTaskId"
  | "saveReviewPipeline"
  | "setReviewDefaultCyclesDraft"
  | "setReviewTaskId"
  | "updateReviewStep"
>;

export type WorkspaceTabsNewTaskProps = Pick<
  WorkspaceTabsViewProps,
  | "confirmTaskDraft"
  | "generateTaskDraft"
  | "newTaskMode"
  | "newTaskTargetId"
  | "newTaskText"
  | "setNewTaskMode"
  | "setNewTaskTargetId"
  | "setNewTaskText"
  | "setTaskDraft"
  | "taskDraft"
>;

export type WorkspaceTabsNotificationsProps = Pick<
  WorkspaceTabsViewProps,
  | "notificationItems"
  | "onApplyLocalPromptConflicts"
  | "onKeepLocalPromptConflicts"
  | "onMarkNotificationRead"
  | "onReloadPromptConflicts"
>;

export type WorkspaceTabsPlanningProps = Pick<WorkspaceTabsViewProps, "statistics" | "todoGroups">;

export type WorkspaceTabsProps = {
  shell: WorkspaceTabsShellProps;
  graphWorkspace: WorkspaceTabsGraphWorkspaceProps;
  autoRun: WorkspaceTabsAutoRunProps;
  fileSync: WorkspaceTabsFileSyncProps;
  search: WorkspaceTabsSearchProps;
  review: WorkspaceTabsReviewProps;
  newTask: WorkspaceTabsNewTaskProps;
  notifications: WorkspaceTabsNotificationsProps;
  planning: WorkspaceTabsPlanningProps;
};

export function WorkspaceTabs(props: WorkspaceTabsProps) {
  const viewProps = createWorkspaceTabsViewProps(props);
  const graphWorkspaceViewProps = createGraphWorkspaceViewProps(props);
  const graphAutoRunViewProps = createAutoRunGraphViewProps(props);
  const searchViewProps = createSearchViewProps(props);
  const todoViewProps = createTodoViewProps(props);
  const {
    activeView
  } = viewProps;
  const content = (() => {
    switch (activeView) {
      case "new-task":
        return <NewTaskView {...viewProps} />;
      case "review-pipeline":
        return <ReviewPipelineView {...viewProps} />;
      case "todo":
        return <TodoView {...todoViewProps} />;
      case "statistics":
        return <StatisticsView {...viewProps} />;
      case "search":
        return <SearchView {...searchViewProps} />;
      case "notifications":
        return <NotificationsView {...viewProps} onOpenGraph={() => viewProps.setActiveView("graph")} />;
      case "canvas-map":
        return <CanvasMapView {...viewProps} />;
      case "graph":
      default:
        return <GraphView {...graphWorkspaceViewProps} {...graphAutoRunViewProps} />;
    }
  })();

  return (
    <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-l-xl bg-app-shell text-text">
      <div className="app-drag-region h-11 shrink-0 border-b border-border/80 bg-app-topbar" />
      <div className={`min-h-0 flex-1 bg-app-canvas ${activeView === "graph" || activeView === "canvas-map" ? "" : "p-4"}`}>
        <div className="h-full min-h-0">
          {content}
        </div>
      </div>
    </section>
  );
}
