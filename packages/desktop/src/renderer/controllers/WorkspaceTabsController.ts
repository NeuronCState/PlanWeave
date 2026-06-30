import type { WorkspaceTabsProps, WorkspaceTabsViewProps } from "../views/WorkspaceTabs";

export function createWorkspaceTabsViewProps(props: WorkspaceTabsProps): WorkspaceTabsViewProps {
  return {
    ...props.shell,
    ...props.graphWorkspace,
    ...props.autoRun,
    ...props.fileSync,
    ...props.search,
    ...props.review,
    ...props.newTask,
    ...props.notifications,
    ...props.planning
  };
}
