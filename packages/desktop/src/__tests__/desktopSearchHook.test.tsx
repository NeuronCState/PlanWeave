/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from "@testing-library/react";
import type { DesktopProjectSummary, DesktopSearchResult } from "@planweave-ai/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDesktopBridgeMock } from "./desktopBridgeMock";

const project: DesktopProjectSummary = {
  projectId: "P-001",
  name: "Demo project",
  rootPath: "/tmp/demo",
  workspaceRoot: "/tmp/demo",
  activeCanvasId: "canvas-main",
  taskCanvases: [
    {
      canvasId: "canvas-main",
      name: "Main canvas",
      taskCount: 2,
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z"
    }
  ]
};

function searchArgs() {
  return {
    handleBlockSelect: vi.fn().mockResolvedValue(undefined),
    handleOpenRunRecord: vi.fn().mockResolvedValue(undefined),
    loadProject: vi.fn().mockResolvedValue(undefined),
    selectedCanvasId: "canvas-main",
    selectedProject: project,
    setActiveView: vi.fn(),
    setError: vi.fn(),
    setSelectedTaskPanelId: vi.fn()
  };
}

async function waitForSearchDebounce(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 350));
  await act(async () => {
    await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("desktop search hook", () => {
  it("debounces bridge calls and deduplicates unchanged filter keys", async () => {
    const searchResults: DesktopSearchResult[] = [{ kind: "task", ref: "T-ALPHA", title: "Alpha task", excerpt: "Alpha task" }];
    const bridge = createDesktopBridgeMock({
      searchProject: vi.fn().mockResolvedValue(searchResults)
    });
    vi.stubGlobal("planweave", bridge);
    vi.resetModules();
    const { useDesktopSearch } = await import("../renderer/hooks/useDesktopSearch");

    const { result } = renderHook(() => useDesktopSearch(searchArgs()));

    act(() => {
      result.current.setSearchQuery("Alpha");
    });

    expect(bridge.searchProject).not.toHaveBeenCalled();

    await waitForSearchDebounce();

    expect(bridge.searchProject).toHaveBeenCalledTimes(1);
    expect(bridge.searchProject).toHaveBeenLastCalledWith(project.rootPath, "Alpha", {
      kinds: ["task", "block", "prompt", "run_record", "review_attempt", "feedback"]
    });
    expect(result.current.searchResults).toEqual(searchResults);

    act(() => {
      result.current.setSearchResultKindEnabled("task", true);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(bridge.searchProject).toHaveBeenCalledTimes(1);
  });

  it("passes result kind and current canvas filters through bridge search", async () => {
    const bridge = createDesktopBridgeMock({
      searchProject: vi.fn().mockResolvedValue([])
    });
    vi.stubGlobal("planweave", bridge);
    vi.resetModules();
    const { useDesktopSearch } = await import("../renderer/hooks/useDesktopSearch");

    const { result } = renderHook(() => useDesktopSearch(searchArgs()));

    act(() => {
      result.current.setSearchQuery("Alpha");
    });
    await waitForSearchDebounce();

    act(() => {
      result.current.setSearchResultKindEnabled("feedback", false);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(bridge.searchProject).toHaveBeenLastCalledWith(project.rootPath, "Alpha", {
      kinds: ["task", "block", "prompt", "run_record", "review_attempt"]
    });

    act(() => {
      result.current.setSearchCanvasScope("current");
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(bridge.searchProject).toHaveBeenLastCalledWith(project.rootPath, "Alpha", {
      kinds: ["task", "block", "prompt", "run_record", "review_attempt"],
      canvasId: "canvas-main"
    });
  });

  it("clears empty queries and prevents stale results from replacing them", async () => {
    let resolveSearch: (results: DesktopSearchResult[]) => void = () => undefined;
    const pendingSearch = new Promise<DesktopSearchResult[]>((resolve) => {
      resolveSearch = resolve;
    });
    const bridge = createDesktopBridgeMock({
      searchProject: vi.fn().mockReturnValue(pendingSearch)
    });
    vi.stubGlobal("planweave", bridge);
    vi.resetModules();
    const { useDesktopSearch } = await import("../renderer/hooks/useDesktopSearch");

    const { result } = renderHook(() => useDesktopSearch(searchArgs()));

    act(() => {
      result.current.setSearchQuery("Alpha");
    });
    await waitForSearchDebounce();
    expect(bridge.searchProject).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setSearchQuery("");
    });
    expect(result.current.searchResults).toEqual([]);

    await act(async () => {
      resolveSearch([{ kind: "task", ref: "T-ALPHA", title: "Alpha task", excerpt: "Alpha task" }]);
      await Promise.resolve();
    });

    expect(result.current.searchResults).toEqual([]);
  });
});
