import type { SetStateAction } from "react";
import type { createTranslator } from "../i18n";
import type {
  WorkspaceTabsGraphWorkspaceProps,
  WorkspaceTabsPlanningProps,
  WorkspaceTabsProps,
  WorkspaceTabsShellProps
} from "../views/WorkspaceTabs";

export type GraphWorkspaceControllerInput = Omit<WorkspaceTabsGraphWorkspaceProps, "onAgentPromptCopied" | "selectedBlockPresent"> & {
  selectedBlock: unknown | null;
  setSuccessMessage: (value: SetStateAction<string | null>) => void;
  t: ReturnType<typeof createTranslator>;
};

export type GraphWorkspaceController = WorkspaceTabsGraphWorkspaceProps;

export function createGraphWorkspaceController({
  selectedBlock,
  setSuccessMessage,
  t,
  ...props
}: GraphWorkspaceControllerInput): GraphWorkspaceController {
  return {
    ...props,
    onAgentPromptCopied: () => setSuccessMessage(t("agentPromptCopied")),
    selectedBlockPresent: Boolean(selectedBlock)
  };
}

export function createGraphWorkspaceViewProps(props: Pick<WorkspaceTabsProps, "graphWorkspace" | "shell">) {
  return {
    ...props.shell,
    ...props.graphWorkspace
  };
}

export function createTodoViewProps(props: {
  graphWorkspace: Pick<WorkspaceTabsGraphWorkspaceProps, "executionPlan" | "handleOpenBlockInspector">;
  planning: Pick<WorkspaceTabsPlanningProps, "todoGroups">;
  shell: Pick<WorkspaceTabsShellProps, "t">;
}) {
  return {
    executionPlan: props.graphWorkspace.executionPlan,
    handleBlockSelect: props.graphWorkspace.handleOpenBlockInspector,
    t: props.shell.t,
    todoGroups: props.planning.todoGroups
  };
}
