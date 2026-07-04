import type { WorkspaceTabsAutoRunProps, WorkspaceTabsFileSyncProps } from "../views/WorkspaceTabs";

export type AutoRunController = WorkspaceTabsAutoRunProps;
export type FileSyncController = WorkspaceTabsFileSyncProps;

export function createAutoRunController(props: AutoRunController): AutoRunController {
  return props;
}

export function createFileSyncController(props: FileSyncController): FileSyncController {
  return props;
}
