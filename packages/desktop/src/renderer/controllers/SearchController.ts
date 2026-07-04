import type { WorkspaceTabsSearchProps } from "../views/WorkspaceTabs";

export type SearchControllerInput = WorkspaceTabsSearchProps;

export type SearchController = WorkspaceTabsSearchProps;

export function createSearchController(props: SearchControllerInput): SearchController {
  const selectedKinds = new Set(props.selectedSearchResultKinds);
  return {
    ...props,
    selectedSearchResultKinds: props.searchResultKinds.filter((kind) => selectedKinds.has(kind))
  };
}
