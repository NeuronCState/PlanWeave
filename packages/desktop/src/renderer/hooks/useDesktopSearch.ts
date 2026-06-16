import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DesktopProjectSummary, DesktopSearchFilters, DesktopSearchResult, DesktopSearchResultKind } from "@planweave-ai/runtime";
import { bridge } from "../bridge";
import { searchNavigationTarget } from "../components/SearchResultList";

export type DesktopSearchCanvasScope = "all" | "current";

export const desktopSearchResultKinds: DesktopSearchResultKind[] = ["task", "block", "prompt", "run_record", "review_attempt", "feedback"];

type UseDesktopSearchArgs = {
  handleBlockSelect: (ref: string, canvasId?: string | null) => Promise<void>;
  handleOpenRunRecord: (recordId: string | null | undefined, canvasId?: string | null) => Promise<void>;
  loadProject: (project: DesktopProjectSummary, canvasId?: string | null) => Promise<void>;
  selectedCanvasId: string | null;
  selectedProject: DesktopProjectSummary | null;
  setError: (message: string | null) => void;
  selectTaskPanel: (taskId: string | null) => void;
};

function normalizeSearchResultKinds(kinds: DesktopSearchResultKind[]): DesktopSearchResultKind[] {
  const selected = new Set(kinds);
  return desktopSearchResultKinds.filter((kind) => selected.has(kind));
}

export function useDesktopSearch({
  handleBlockSelect,
  handleOpenRunRecord,
  loadProject,
  selectedCanvasId,
  selectedProject,
  setError,
  selectTaskPanel
}: UseDesktopSearchArgs) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DesktopSearchResult[]>([]);
  const [selectedSearchResultKinds, setSelectedSearchResultKinds] = useState<DesktopSearchResultKind[]>(() => [...desktopSearchResultKinds]);
  const [searchCanvasScope, setSearchCanvasScope] = useState<DesktopSearchCanvasScope>("all");
  const lastSearchKeyRef = useRef<string | null>(null);
  const clearSearchResults = useCallback(() => {
    setSearchResults((current) => (current.length ? [] : current));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const setSearchResultKindEnabled = useCallback((kind: DesktopSearchResultKind, enabled: boolean) => {
    setSelectedSearchResultKinds((current) => {
      const next = new Set(current);
      if (enabled) {
        next.add(kind);
      } else if (next.size > 1) {
        next.delete(kind);
      }
      const normalized = normalizeSearchResultKinds([...next]);
      return normalized.length === current.length && normalized.every((value, index) => value === current[index]) ? current : normalized;
    });
  }, []);

  const selectedSearchKindKey = selectedSearchResultKinds.join(",");
  const projectRoot = selectedProject?.rootPath ?? null;
  const normalizedDebouncedQuery = debouncedSearchQuery.trim();
  const rawQueryIsEmpty = !searchQuery.trim();
  const canvasFilterId = searchCanvasScope === "current" && selectedCanvasId ? selectedCanvasId : undefined;
  const searchKey = useMemo(() => {
    if (!projectRoot || !normalizedDebouncedQuery) {
      return null;
    }
    return [projectRoot, normalizedDebouncedQuery.toLowerCase(), selectedSearchKindKey, canvasFilterId ?? "all"].join("\u001f");
  }, [canvasFilterId, normalizedDebouncedQuery, projectRoot, selectedSearchKindKey]);

  useEffect(() => {
    if (!bridge || !projectRoot || rawQueryIsEmpty || !normalizedDebouncedQuery || !searchKey) {
      clearSearchResults();
      lastSearchKeyRef.current = null;
      return;
    }
    if (lastSearchKeyRef.current === searchKey) {
      return;
    }
    lastSearchKeyRef.current = searchKey;
    let cancelled = false;
    const filters: DesktopSearchFilters = {
      kinds: selectedSearchResultKinds
    };
    if (canvasFilterId) {
      filters.canvasId = canvasFilterId;
    }
    bridge
      .searchProject(projectRoot, normalizedDebouncedQuery, filters)
      .then((results) => {
        if (!cancelled) {
          setSearchResults(results);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canvasFilterId, clearSearchResults, normalizedDebouncedQuery, projectRoot, rawQueryIsEmpty, searchKey, selectedSearchResultKinds, setError]);

  const handleSearchResultOpen = useCallback(
    async (result: DesktopSearchResult) => {
      if (selectedProject && result.canvasId && result.canvasId !== selectedCanvasId) {
        await loadProject(selectedProject, result.canvasId);
      }
      const target = searchNavigationTarget(result);
      if (target.kind === "task") {
        selectTaskPanel(target.ref);
        return;
      }
      if (target.kind === "block") {
        await handleBlockSelect(target.ref, result.canvasId ?? selectedCanvasId);
        return;
      }
      if (target.kind === "record") {
        await handleOpenRunRecord(target.recordId, result.canvasId ?? selectedCanvasId);
      }
    },
    [handleBlockSelect, handleOpenRunRecord, loadProject, selectedCanvasId, selectedProject, selectTaskPanel]
  );

  return {
    desktopSearchResultKinds,
    handleSearchResultOpen,
    searchCanvasScope,
    searchQuery,
    searchResults,
    selectedSearchResultKinds,
    setSearchCanvasScope,
    setSearchQuery,
    setSearchResultKindEnabled
  };
}
