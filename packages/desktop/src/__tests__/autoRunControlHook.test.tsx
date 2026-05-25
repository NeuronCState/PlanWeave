/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from "@testing-library/react";
import type { DesktopAutoRunState, DesktopBlockDetail, DesktopProjectSummary } from "@planweave/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDesktopBridgeMock } from "./desktopBridgeMock";
import { createTranslator } from "../renderer/i18n";

const project: DesktopProjectSummary = {
  projectId: "P-001",
  name: "Demo project",
  rootPath: "/tmp/demo",
  workspaceRoot: "/tmp/demo",
  taskCanvases: []
};

const selectedBlock: DesktopBlockDetail = {
  ref: "T-ALPHA#B-001",
  taskId: "T-ALPHA",
  blockId: "B-001",
  type: "implementation",
  title: "Implement alpha",
  status: "ready",
  executor: null,
  effectiveExecutor: "codex",
  promptMarkdown: "# Implement alpha",
  dependencies: [],
  latestRunId: null,
  latestReviewAttemptId: null,
  activeFeedbackId: null,
  exceptionReason: null,
  reviewGate: null
};

function autoRunState(patch: Partial<DesktopAutoRunState> = {}): DesktopAutoRunState {
  return {
    runId: "DESKTOP-RUN-0001",
    projectRoot: project.rootPath,
    canvasId: "canvas-main",
    scope: { kind: "project" },
    phase: "running",
    stepCount: 0,
    stepLimit: 20,
    currentRef: null,
    currentExecutor: null,
    elapsedMs: 0,
    latestOutputSummary: null,
    latestRecordId: null,
    latestRecordPath: null,
    statePath: "/tmp/project/.planweave/results/auto-runs/DESKTOP-RUN-0001/state.json",
    eventLogPath: "/tmp/project/.planweave/results/auto-runs/DESKTOP-RUN-0001/events.ndjson",
    options: { tmuxEnabled: true },
    error: null,
    startedAt: "2026-05-23T00:00:00.000Z",
    updatedAt: "2026-05-23T00:00:00.000Z",
    ...patch
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("auto run control hook", () => {
  it("keeps selected block auto-run scope narrow", async () => {
    const runningState = autoRunState({ scope: { kind: "block", blockRef: selectedBlock.ref } });
    const bridge = createDesktopBridgeMock({
      startAutoRun: vi.fn().mockResolvedValue(runningState)
    });
    vi.stubGlobal("planweave", bridge);
    vi.resetModules();
    const { useAutoRunControl } = await import("../renderer/hooks/useAutoRunControl");

    const { result } = renderHook(() =>
      useAutoRunControl({
        selectedCanvasId: "canvas-main",
        selectedBlock,
        selectedProject: project,
        selectedTaskPanelId: null,
        setError: vi.fn(),
        t: createTranslator("zh-CN"),
        tmuxMonitoringEnabled: true
      })
    );

    await act(async () => {
      result.current.setAutoRunScopeMode("selectedBlock");
    });
    await act(async () => {
      await result.current.handleAutoRunClick();
    });

    expect(bridge.startAutoRun).toHaveBeenCalledWith(
      { projectRoot: project.rootPath, canvasId: "canvas-main" },
      { kind: "block", blockRef: selectedBlock.ref },
      20,
      { tmuxEnabled: true }
    );
  });

  it("unblocks the current blocked block before retrying auto-run", async () => {
    const blockedState = autoRunState({
      phase: "blocked",
      stepCount: 1,
      currentRef: selectedBlock.ref,
      latestOutputSummary: "Executor failed",
      error: "Executor failed",
      updatedAt: "2026-05-23T00:00:01.000Z"
    });
    const runningState = autoRunState({
      runId: "DESKTOP-RUN-0002",
      startedAt: "2026-05-23T00:00:02.000Z",
      updatedAt: "2026-05-23T00:00:02.000Z"
    });
    const calls: string[] = [];
    const bridge = createDesktopBridgeMock({
      unblockBlock: vi.fn().mockImplementation(async () => {
        calls.push("unblock");
      }),
      startAutoRun: vi.fn().mockImplementation(async () => {
        calls.push("start");
        return runningState;
      })
    });
    vi.stubGlobal("planweave", bridge);
    vi.resetModules();
    const { useAutoRunControl } = await import("../renderer/hooks/useAutoRunControl");

    const { result } = renderHook(() =>
      useAutoRunControl({
        selectedCanvasId: "canvas-main",
        selectedBlock: null,
        selectedProject: project,
        selectedTaskPanelId: null,
        setError: vi.fn(),
        t: createTranslator("zh-CN"),
        tmuxMonitoringEnabled: false
      })
    );

    await act(async () => {
      result.current.setAutoRunState(blockedState);
    });
    await act(async () => {
      await result.current.handleAutoRunClick();
    });

    expect(bridge.unblockBlock).toHaveBeenCalledWith({ projectRoot: project.rootPath, canvasId: "canvas-main" }, selectedBlock.ref, "Retry requested from Auto Run.");
    expect(bridge.startAutoRun).toHaveBeenCalledWith(
      { projectRoot: project.rootPath, canvasId: "canvas-main" },
      { kind: "project" },
      20,
      { tmuxEnabled: false }
    );
    expect(calls).toEqual(["unblock", "start"]);
    expect(result.current.autoRunState).toEqual(runningState);
  });

  it("refreshes graph data while auto-run polling advances through pausing", async () => {
    vi.useFakeTimers();
    const runningState = autoRunState();
    const pausingState = autoRunState({
      phase: "pausing",
      stepCount: 1,
      currentRef: selectedBlock.ref,
      updatedAt: "2026-05-23T00:00:01.000Z"
    });
    const refreshedState = autoRunState({
      ...pausingState,
      phase: "paused",
      updatedAt: "2026-05-23T00:00:02.000Z"
    });
    const bridge = createDesktopBridgeMock({
      startAutoRun: vi.fn().mockResolvedValue(runningState),
      getAutoRunState: vi.fn().mockResolvedValueOnce(pausingState).mockResolvedValueOnce(refreshedState)
    });
    vi.stubGlobal("planweave", bridge);
    vi.resetModules();
    const { useAutoRunControl } = await import("../renderer/hooks/useAutoRunControl");
    const onAutoRunStateRefresh = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useAutoRunControl({
        onAutoRunStateRefresh,
        selectedCanvasId: "canvas-main",
        selectedBlock: null,
        selectedProject: project,
        selectedTaskPanelId: null,
        setError: vi.fn(),
        t: createTranslator("zh-CN"),
        tmuxMonitoringEnabled: true
      })
    );

    await act(async () => {
      await result.current.handleAutoRunClick();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(bridge.getAutoRunState).toHaveBeenCalledTimes(2);
    expect(bridge.getAutoRunState).toHaveBeenCalledWith("DESKTOP-RUN-0001");
    expect(onAutoRunStateRefresh).toHaveBeenCalledWith(refreshedState);
  });

  it("refreshes graph data once after auto-run reaches a settled phase", async () => {
    vi.useFakeTimers();
    const pausedState = autoRunState({
      phase: "paused",
      stepCount: 1,
      currentRef: selectedBlock.ref,
      currentExecutor: "codex",
      elapsedMs: 1000,
      latestOutputSummary: "paused after block",
      latestRecordId: "T-ALPHA#B-001::RUN-001",
      latestRecordPath: "/tmp/metadata.json",
      updatedAt: "2026-05-23T00:00:01.000Z"
    });
    vi.stubGlobal("planweave", createDesktopBridgeMock());
    vi.resetModules();
    const { useAutoRunControl } = await import("../renderer/hooks/useAutoRunControl");
    const onAutoRunStateRefresh = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useAutoRunControl({
        onAutoRunStateRefresh,
        selectedCanvasId: "canvas-main",
        selectedBlock: null,
        selectedProject: project,
        selectedTaskPanelId: null,
        setError: vi.fn(),
        t: createTranslator("zh-CN"),
        tmuxMonitoringEnabled: true
      })
    );

    await act(async () => {
      result.current.setAutoRunState(pausedState);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(onAutoRunStateRefresh).toHaveBeenCalledWith(pausedState);
  });
});
