/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DesktopCanvasGraphViewModel, DesktopProjectSummary } from "@planweave-ai/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "../renderer/i18n";
import { CanvasMapView } from "../renderer/views/CanvasMapView";

const useCanvasMapMock = vi.hoisted(() => vi.fn());

vi.mock("../renderer/hooks/useCanvasMap", () => ({
  useCanvasMap: useCanvasMapMock
}));

vi.mock("@xyflow/react", async () => {
  const React = await import("react");
  return {
    Background: () => <div data-testid="react-flow-background" />,
    Controls: () => <div data-testid="react-flow-controls" />,
    MiniMap: () => <div data-testid="react-flow-minimap" />,
    ReactFlow: (props: { children?: React.ReactNode }) => <div data-testid="react-flow">{props.children}</div>,
    useEdgesState: <T,>(initial: T[]) => {
      const [edges, setEdges] = React.useState(initial);
      return [edges, setEdges, vi.fn()] as const;
    },
    useNodesState: <T,>(initial: T[]) => {
      const [nodes, setNodes] = React.useState(initial);
      return [nodes, setNodes, vi.fn()] as const;
    }
  };
});

const longProjectRoot = "/Users/mrbrain/.planweave/projects/ecco-the-dolphin-opencode-with-a-very-long-unbroken-folder-name";
const longSourceRoot = "/Users/mrbrain/code/test/ecco-the-dolphin-opencode-with-a-very-long-unbroken-folder-name";

const project: DesktopProjectSummary = {
  activeCanvasId: "default",
  kind: "managed",
  name: "Ecco the Dolphin opencode",
  projectId: "ecco-the-dolphin-opencode",
  rootPath: longProjectRoot,
  sourceRoot: longSourceRoot,
  taskCanvases: [],
  workspaceRoot: longProjectRoot
};

const canvasGraph: DesktopCanvasGraphViewModel = {
  canvases: [
    {
      canvasId: "default",
      diagnostics: [],
      packageDir: "canvases/default/package",
      title: "Ecco the Dolphin opencode"
    }
  ],
  crossTaskEdges: [],
  diagnostics: [],
  edges: [],
  health: {
    blockedBlocks: [],
    canvases: [{ blockerCount: 0, canvasId: "default", diagnosticCount: 0, severity: "ok" }],
    diagnostics: [],
    edges: [],
    severity: "ok"
  },
  projectId: project.projectId,
  projectTitle: project.name
};

function renderCanvasMapView(patch: Partial<Parameters<typeof CanvasMapView>[0]> = {}) {
  render(
    <CanvasMapView
      handleOpenBlockInspector={vi.fn().mockResolvedValue(undefined)}
      handleOpenProject={vi.fn().mockResolvedValue(undefined)}
      loadProject={vi.fn().mockResolvedValue(undefined)}
      onTaskPanelSelect={vi.fn()}
      selectedCanvasId="default"
      selectedProject={project}
      setActiveView={vi.fn()}
      setError={vi.fn()}
      t={createTranslator("en")}
      {...patch}
    />
  );
}

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: vi.fn().mockResolvedValue(undefined)
    }
  });
  useCanvasMapMock.mockReturnValue({
    canvasGraph,
    canvasMapLayout: null,
    resetCanvasMapLayout: vi.fn().mockResolvedValue(undefined),
    saveCanvasMapLayoutFromNodes: vi.fn().mockResolvedValue(undefined),
    selectedCanvas: canvasGraph.canvases[0],
    selectedMapCanvasId: "default",
    setSelectedMapCanvasId: vi.fn()
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CanvasMapView agent scope layout", () => {
  it("renders long agent scope paths as line-breakable text", () => {
    renderCanvasMapView();

    expect(screen.getByText(longProjectRoot)).toHaveStyle({ overflowWrap: "anywhere" });
    expect(screen.getByText(longSourceRoot)).toHaveStyle({ overflowWrap: "anywhere" });
  });

  it("announces when the agent scope prompt is copied", async () => {
    const onAgentPromptCopied = vi.fn();
    renderCanvasMapView({ onAgentPromptCopied });

    fireEvent.click(screen.getByRole("button", { name: "Copy agent prompt" }));

    await waitFor(() => expect(onAgentPromptCopied).toHaveBeenCalledTimes(1));
  });
});
