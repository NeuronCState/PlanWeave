/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentSettingsPanel } from "../renderer/components/AgentSettingsPanel";
import { SettingsView } from "../renderer/views/SettingsView";
import { createTranslator } from "../renderer/i18n";
import { defaultDesktopSettings } from "../renderer/settings";
import type { DesktopUiSettings } from "../renderer/types";
import type { DesktopProjectSummary } from "@planweave-ai/runtime";

const settings: DesktopUiSettings = {
  runtimePath: "/tmp/project",
  defaultExecutor: "",
  appearance: "system",
  language: "en",
  readNotificationIds: [],
  notifications: {
    autoRunFailure: true,
    graphExceptions: true,
    dirtyPrompts: true,
    fileSyncConflict: true
  },
  palette: {
    visible: {
      task: true,
      implementation: true,
      review: true
    },
    defaultBlockSet: ["implementation", "review"],
    dragHint: true
  },
  review: {
    autoAppendReviewBlock: true,
    feedbackLoop: true,
    pipelineEnabled: true,
    strictReview: true
  },
  execution: {
    tmuxMonitoring: true
  },
  agents: {
    codex: {
      enabled: false,
      fullAccess: false
    },
    "claude-code": {
      enabled: false,
      fullAccess: false
    },
    opencode: {
      enabled: false,
      fullAccess: false
    }
  }
};

const projectA: DesktopProjectSummary = {
  projectId: "project-a",
  name: "Project A",
  rootPath: "/tmp/project-a",
  workspaceRoot: "/tmp/.planweave/project-a",
  activeCanvasId: "default",
  taskCanvases: []
};

const projectB: DesktopProjectSummary = {
  projectId: "project-b",
  name: "Project B",
  rootPath: "/tmp/project-b",
  workspaceRoot: "/tmp/.planweave/project-b",
  activeCanvasId: "default",
  taskCanvases: []
};

function stubLayoutApis() {
  class ResizeObserverMock {
    disconnect = vi.fn();
    observe = vi.fn();
    unobserve = vi.fn();
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  Object.defineProperty(window.HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: vi.fn(() => false) });
  Object.defineProperty(window.HTMLElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() });
  Object.defineProperty(window.HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: vi.fn() });
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("desktop renderer settings interactions", () => {
  it("defaults new task cards to implementation blocks only", () => {
    expect(defaultDesktopSettings.palette.defaultBlockSet).toEqual(["implementation"]);
  });

  it("renders the interface language setting as a dropdown select", async () => {
    stubLayoutApis();
    const updateSettings = vi.fn();

    render(
      <SettingsView
        agentDetectionRefreshing={false}
        agents={[]}
        graph={null}
        language="zh-CN"
        refreshAgentDetections={vi.fn().mockResolvedValue(undefined)}
        refreshRuntimeTools={vi.fn().mockResolvedValue(undefined)}
        runtimeTools={{ tmux: { available: true, command: "tmux" } }}
        projects={[]}
        setActiveView={vi.fn()}
        settings={{ ...settings, language: "zh-CN" }}
        t={createTranslator("zh-CN")}
        updateSettings={updateSettings}
      />
    );

    expect(screen.queryByRole("switch", { name: "语言" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "语言" }));
    await userEvent.click(screen.getByRole("option", { name: "English" }));

    expect(updateSettings).toHaveBeenCalledWith({ language: "en" });
  });

  it("only enables tmux monitoring when the runtime tool is detected", async () => {
    stubLayoutApis();
    const refreshRuntimeTools = vi.fn().mockResolvedValue(undefined);
    const updateSettings = vi.fn();

    const { rerender } = render(
      <SettingsView
        agentDetectionRefreshing={false}
        agents={[]}
        graph={null}
        language="en"
        refreshAgentDetections={vi.fn().mockResolvedValue(undefined)}
        refreshRuntimeTools={refreshRuntimeTools}
        runtimeTools={{ tmux: { available: false, command: "tmux" } }}
        projects={[]}
        setActiveView={vi.fn()}
        settings={settings}
        t={createTranslator("en")}
        updateSettings={updateSettings}
      />
    );

    const unavailableSwitch = screen.getByRole("switch", { name: "tmux monitoring" });
    expect(unavailableSwitch).toBeDisabled();
    expect(unavailableSwitch).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Refresh tools" }));
    expect(refreshRuntimeTools).toHaveBeenCalledTimes(1);

    rerender(
      <SettingsView
        agentDetectionRefreshing={false}
        agents={[]}
        graph={null}
        language="en"
        refreshAgentDetections={vi.fn().mockResolvedValue(undefined)}
        refreshRuntimeTools={refreshRuntimeTools}
        runtimeTools={{ tmux: { available: true, command: "tmux" } }}
        projects={[]}
        setActiveView={vi.fn()}
        settings={{ ...settings, execution: { tmuxMonitoring: false } }}
        t={createTranslator("en")}
        updateSettings={updateSettings}
      />
    );

    await userEvent.click(screen.getByRole("switch", { name: "tmux monitoring" }));
    expect(updateSettings).toHaveBeenCalledWith({ execution: { tmuxMonitoring: true } });
  });

  it("lets the current project disable inherited global prompt policy", async () => {
    stubLayoutApis();
    const updateProjectPromptPolicy = vi.fn().mockResolvedValue(undefined);

    render(
      <SettingsView
        agentDetectionRefreshing={false}
        agents={[]}
        graph={null}
        language="en"
        projectPromptPolicy={{ includeGlobalPrompt: true }}
        selectedProject={projectA}
        refreshAgentDetections={vi.fn().mockResolvedValue(undefined)}
        refreshRuntimeTools={vi.fn().mockResolvedValue(undefined)}
        runtimeTools={{ tmux: { available: true, command: "tmux" } }}
        projects={[]}
        setActiveView={vi.fn()}
        settings={settings}
        t={createTranslator("en")}
        updateProjectPromptPolicy={updateProjectPromptPolicy}
        updateSettings={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("switch", { name: "Inherit global prompt" }));

    expect(updateProjectPromptPolicy).toHaveBeenCalledWith({ includeGlobalPrompt: false });
  });

  it("switches the project whose prompt policy is edited", async () => {
    stubLayoutApis();
    const loadProject = vi.fn().mockResolvedValue(undefined);

    render(
      <SettingsView
        agentDetectionRefreshing={false}
        agents={[]}
        graph={null}
        language="en"
        projectPromptPolicy={{ includeGlobalPrompt: true }}
        projects={[projectA, projectB]}
        selectedProject={projectA}
        loadProject={loadProject}
        refreshAgentDetections={vi.fn().mockResolvedValue(undefined)}
        refreshRuntimeTools={vi.fn().mockResolvedValue(undefined)}
        runtimeTools={{ tmux: { available: true, command: "tmux" } }}
        setActiveView={vi.fn()}
        settings={settings}
        t={createTranslator("en")}
        updateProjectPromptPolicy={vi.fn().mockResolvedValue(undefined)}
        updateSettings={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("combobox", { name: "Project" }));
    await userEvent.click(screen.getByRole("option", { name: "Project B" }));

    expect(loadProject).toHaveBeenCalledWith(projectB);
  });

  it("shows and saves the current project canvas prompt", async () => {
    stubLayoutApis();
    const updateProjectPrompt = vi.fn().mockResolvedValue(undefined);

    render(
      <SettingsView
        agentDetectionRefreshing={false}
        agents={[]}
        graph={null}
        language="en"
        projectPromptMarkdown={"# Project/Canvas Prompt\n\nVisible policy."}
        projectPromptPolicy={{ includeGlobalPrompt: true }}
        selectedProject={projectA}
        refreshAgentDetections={vi.fn().mockResolvedValue(undefined)}
        refreshRuntimeTools={vi.fn().mockResolvedValue(undefined)}
        runtimeTools={{ tmux: { available: true, command: "tmux" } }}
        projects={[]}
        setActiveView={vi.fn()}
        settings={settings}
        t={createTranslator("en")}
        updateProjectPrompt={updateProjectPrompt}
        updateProjectPromptPolicy={vi.fn().mockResolvedValue(undefined)}
        updateSettings={vi.fn()}
      />
    );

    const editor = screen.getByRole("textbox", { name: "Project/Canvas Prompt" });
    expect(editor).toHaveValue("# Project/Canvas Prompt\n\nVisible policy.");
    await userEvent.clear(editor);
    await userEvent.type(editor, "Updated project policy.");
    await userEvent.click(screen.getByRole("button", { name: "Save Project/Canvas Prompt" }));

    expect(updateProjectPrompt).toHaveBeenCalledWith("Updated project policy.");
  });

  it("keeps project prompt editable while prompt markdown is loading", async () => {
    stubLayoutApis();
    const updateProjectPrompt = vi.fn().mockResolvedValue(undefined);

    render(
      <SettingsView
        agentDetectionRefreshing={false}
        agents={[]}
        graph={null}
        language="en"
        projectPromptMarkdown={null}
        projectPromptPolicy={{ includeGlobalPrompt: true }}
        selectedProject={projectA}
        refreshAgentDetections={vi.fn().mockResolvedValue(undefined)}
        refreshRuntimeTools={vi.fn().mockResolvedValue(undefined)}
        runtimeTools={{ tmux: { available: true, command: "tmux" } }}
        projects={[projectA]}
        setActiveView={vi.fn()}
        settings={settings}
        t={createTranslator("en")}
        updateProjectPrompt={updateProjectPrompt}
        updateProjectPromptPolicy={vi.fn().mockResolvedValue(undefined)}
        updateSettings={vi.fn()}
      />
    );

    const editor = screen.getByRole("textbox", { name: "Project/Canvas Prompt" });
    expect(editor).toBeEnabled();
    await userEvent.type(editor, "Policy while graph is unavailable.");
    await userEvent.click(screen.getByRole("button", { name: "Save Project/Canvas Prompt" }));

    expect(updateProjectPrompt).toHaveBeenCalledWith("Policy while graph is unavailable.");
  });

  it("disables agent switches when the CLI is not detected", async () => {
    const refreshAgentDetections = vi.fn().mockResolvedValue(undefined);

    render(
      <AgentSettingsPanel
        agentDetectionRefreshing={false}
        agents={[
          {
            kind: "codex",
            name: "Codex",
            command: "codex",
            versionArgs: ["--version"],
            execArgs: ["exec", "-"],
            fullAccessArgs: ["exec", "--sandbox", "danger-full-access", "-"],
            installed: false,
            version: null,
            unavailableReason: "not found"
          }
        ]}
        labels={{
          agentDetected: "CLI detected",
          agentEnableDescription: "Run {command}",
          agentFullAccess: "Full access",
          agentFullAccessDescription: "Run {command}",
          agentInstallStatus: "Local agent installation status",
          agentMissing: "CLI not detected",
          agentRefresh: "Refresh",
          agentRefreshing: "Refreshing"
        }}
        refreshAgentDetections={refreshAgentDetections}
        settings={settings}
        updateSettings={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(refreshAgentDetections).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("switch", { name: "Codex" })).toBeDisabled();
    expect(screen.queryByText("Full access")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Codex options" }));
    expect(screen.getByRole("switch", { name: "Full access" })).toBeDisabled();
  });
});
