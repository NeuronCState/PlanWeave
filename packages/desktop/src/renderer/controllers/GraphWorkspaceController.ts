import type { SetStateAction } from "react";
import type { createTranslator } from "../i18n";
import type {
  WorkspaceTabsGraphWorkspaceProps
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
