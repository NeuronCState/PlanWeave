import type { WorkspaceTabsAutoRunProps, WorkspaceTabsFileSyncProps } from "../views/WorkspaceTabs";
import type { WorkspaceTabsProps } from "../views/WorkspaceTabs";

export type AutoRunController = WorkspaceTabsAutoRunProps;
export type FileSyncController = WorkspaceTabsFileSyncProps;

export function createAutoRunController(props: AutoRunController): AutoRunController {
  return props;
}

export function createFileSyncController(props: FileSyncController): FileSyncController {
  return props;
}

export function createAutoRunGraphViewProps(props: Pick<WorkspaceTabsProps, "autoRun" | "fileSync">) {
  return {
    ...props.autoRun,
    ...props.fileSync
  };
}
