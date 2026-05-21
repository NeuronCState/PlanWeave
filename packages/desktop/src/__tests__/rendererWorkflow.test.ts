import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("desktop renderer workflow wiring", () => {
  it("keeps the Electron smoke on real renderer interactions without test-only IPC", async () => {
    const [mainSource, smokeSource] = await Promise.all([
      readFile(resolve(sourceDir, "main", "main.ts"), "utf8"),
      readFile(resolve(sourceDir, "main", "smoke.ts"), "utf8")
    ]);

    expect(smokeSource).toContain("async function runRendererManualSmoke");
    expect(smokeSource).toContain('await clickByText("新任务")');
    expect(smokeSource).toContain('await clickByText("生成 Draft")');
    expect(smokeSource).toContain('await clickByText("确认写入")');
    expect(smokeSource).toContain('await clickByText("统计")');
    expect(smokeSource).toContain('await clickByText("搜索")');
    expect(smokeSource).toContain('await clickByLabel("设置")');
    expect(smokeSource).toContain('await clickByText("UI Smoke Task")');
    expect(smokeSource).toContain('await waitForSelector("[data-auto-run-control]", "Floating Auto Run control")');
    expect(smokeSource).toContain('await clickByLabel("Auto Run")');
    expect(smokeSource).toContain('await clickByText("Todo")');
    expect(smokeSource).toContain('await clickByText("添加 Review Step")');
    expect(smokeSource).toContain('await clickByText("保存 Review Pipeline")');
    expect(smokeSource).toContain('await waitForText("组件设置")');
    expect(smokeSource).not.toContain("planweave:rendererSmoke");
    expect(mainSource).toContain('app.setPath("userData", process.env.PLANWEAVE_DESKTOP_SMOKE_USER_DATA_DIR)');
  });

  it("expands the selected project into task panels without adding bridge APIs", async () => {
    const sidebarSource = await readFile(resolve(sourceDir, "renderer", "sidebar", "ProjectSidebar.tsx"), "utf8");

    expect(sidebarSource).toContain("graph.tasks.map((task)");
    expect(sidebarSource).toContain("handleTaskPanelSelect(task.taskId)");
    expect(sidebarSource).not.toContain("window.planweave.getTaskPanels");
  });

  it("routes todo and search selections back to the graph canvas", async () => {
    const [searchHookSource, searchListSource, todoSource] = await Promise.all([
      readFile(resolve(sourceDir, "renderer", "hooks", "useDesktopSearch.ts"), "utf8"),
      readFile(resolve(sourceDir, "renderer", "components", "SearchResultList.tsx"), "utf8"),
      readFile(resolve(sourceDir, "renderer", "views", "TodoView.tsx"), "utf8")
    ]);

    expect(searchHookSource).toContain('setActiveView("graph")');
    expect(searchHookSource).toContain("setSelectedTaskPanelId(target.ref)");
    expect(searchListSource).toContain("function searchNavigationTarget");
    expect(searchHookSource).toContain('target.kind === "context"');
    expect(searchHookSource).toContain("setSelectedContextNodeId(target.ref)");
    expect(todoSource).toContain("onSelect={(ref) => void handleBlockSelect(ref)}");
    expect(todoSource).toContain('"implemented"].includes(status)');
    expect(todoSource).not.toContain('"completed"].includes(status)');
  });

  it("keeps the graph toolbar compact without duplicate search or project header", async () => {
    const workspaceSource = await readFile(resolve(sourceDir, "renderer", "views", "WorkspaceTabs.tsx"), "utf8");

    expect(workspaceSource).not.toContain("<header className=");
    expect(workspaceSource).not.toContain('<TabsTrigger value="search">');
    expect(workspaceSource).not.toContain('placeholder={t("searchPlaceholder")}');
    expect(workspaceSource).toContain('value="search"');
    expect(workspaceSource).toContain('onClick={() => void refreshPackageFiles()}');
    expect(workspaceSource).toContain("onClick={resetLayout}");
  });

  it("keeps the mini run panel user-opened instead of a fixed log panel", async () => {
    const runControlSource = await readFile(resolve(sourceDir, "renderer", "run", "FloatingAutoRunControl.tsx"), "utf8");

    expect(runControlSource).toContain("miniRunPanelOpen");
    expect(runControlSource).toContain("setMiniRunPanelOpen(true)");
    expect(runControlSource).toContain("<PopoverContent align=\"end\" className=\"w-96\">");
    expect(runControlSource).toContain("formatElapsed(autoRunState.elapsedMs)");
    expect(runControlSource).toContain("autoRunState?.currentExecutor");
    expect(runControlSource).toContain('t("currentBlock")');
    expect(runControlSource).toContain('t("stepCount")');
  });

  it("keeps the Floating Auto Run control draggable in renderer state", async () => {
    const [runHookSource, runControlSource, graphViewSource] = await Promise.all([
      readFile(resolve(sourceDir, "renderer", "hooks", "useAutoRunControl.ts"), "utf8"),
      readFile(resolve(sourceDir, "renderer", "run", "FloatingAutoRunControl.tsx"), "utf8"),
      readFile(resolve(sourceDir, "renderer", "views", "GraphView.tsx"), "utf8")
    ]);

    expect(runHookSource).toContain("autoRunControlPosition");
    expect(runControlSource).toContain("data-auto-run-control");
    expect(graphViewSource).toContain("data-graph-surface");
    expect(runHookSource).toContain("setPointerCapture(event.pointerId)");
    expect(runControlSource).toContain("onPointerMove={moveAutoRunControl}");
    expect(runHookSource).not.toContain("planweave:saveAutoRunControl");
  });

  it("supports right-click or long-press Auto Run scope selection", async () => {
    const runControlSource = await readFile(resolve(sourceDir, "renderer", "run", "FloatingAutoRunControl.tsx"), "utf8");

    expect(runControlSource).toContain("ContextMenuTrigger asChild");
    expect(runControlSource).toContain("<ContextMenuRadioGroup value={autoRunScopeMode}");
    expect(runControlSource).toContain('<ContextMenuRadioItem value="project">');
    expect(runControlSource).toContain('<ContextMenuRadioItem disabled={!selectedTaskPanelId && !selectedBlockPresent} value="selectedTask">');
    expect(runControlSource).toContain('<ContextMenuRadioItem disabled={!selectedBlockPresent} value="selectedBlock">');
  });

  it("supports dragging palette components onto the graph without widening IPC", async () => {
    const [appSource, graphViewSource, paletteSource, paletteHookSource, settingsSource] = await Promise.all([
      readFile(resolve(sourceDir, "renderer", "App.tsx"), "utf8"),
      readFile(resolve(sourceDir, "renderer", "views", "GraphView.tsx"), "utf8"),
      readFile(resolve(sourceDir, "renderer", "palette", "ComponentPalette.tsx"), "utf8"),
      readFile(resolve(sourceDir, "renderer", "hooks", "useGraphPaletteActions.ts"), "utf8"),
      readFile(resolve(sourceDir, "renderer", "views", "SettingsView.tsx"), "utf8")
    ]);

    expect(paletteSource).toContain("handlePaletteDragStart");
    expect(graphViewSource).toContain("onInit={setFlowInstance}");
    expect(settingsSource).toContain("<PaletteSettingsPanel");
    expect(appSource).not.toContain('setActiveView("component-settings")');
    expect(appSource).not.toContain('value="component-settings"');
    expect(paletteHookSource).toContain('event.dataTransfer.setData("application/x-planweave-palette", type)');
    expect(graphViewSource).toContain("onDragOver={handleGraphDragOver}");
    expect(graphViewSource).toContain("onDrop={handleGraphDrop}");
    expect(paletteHookSource).toContain("screenToFlowPosition");
    expect(paletteHookSource).toContain("previousTaskIds");
    expect(paletteHookSource).toContain("previousContextIds");
    expect(paletteHookSource).toContain("nodeId: createdContext.nodeId");
    expect(paletteHookSource).toContain("bridge.saveDesktopLayout(selectedProject.rootPath, nextLayout)");
    expect(paletteHookSource).toContain('void addPaletteComponent(type, type === "task" || type === "context" ? dropPosition : undefined)');
    expect(paletteHookSource).not.toContain("dragPaletteComponent(");
  });

  it("loads lightweight block execution records when a block is selected", async () => {
    const [blockHookSource, previewSource] = await Promise.all([
      readFile(resolve(sourceDir, "renderer", "hooks", "useSelectedBlock.ts"), "utf8"),
      readFile(resolve(sourceDir, "renderer", "graph", "BlockPreviewButton.tsx"), "utf8")
    ]);

    expect(blockHookSource).toContain("bridge.listBlockRunRecords(selectedProject.rootPath, ref)");
    expect(blockHookSource).toContain("bridge.getReviewAttempts(selectedProject.rootPath, ref)");
    expect(blockHookSource).toContain("bridge.getFeedbackRecords(selectedProject.rootPath, ref)");
    expect(previewSource).toContain("blockExecutionSummary");
    expect(previewSource).toContain("latestFeedbackRecord");
  });

  it("edits block details from a cursor-near block preview popover", async () => {
    const previewSource = await readFile(resolve(sourceDir, "renderer", "graph", "BlockPreviewButton.tsx"), "utf8");

    expect(previewSource).toContain("function BlockPreviewButton");
    expect(previewSource).toContain("<PopoverTrigger asChild>");
    expect(previewSource).toContain('<PopoverContent align="start" className="w-[420px]">');
    expect(previewSource).toContain("onBlockTitleSave");
    expect(previewSource).toContain("onBlockExecutorChange");
    expect(previewSource).toContain("onBlockPromptSave");
  });

  it("edits full task source prompts and autosaves dirty prompt drafts", async () => {
    const promptDraftSource = await readFile(resolve(sourceDir, "renderer", "hooks", "usePromptDrafts.ts"), "utf8");

    expect(promptDraftSource).toContain("[task.taskId, task.promptMarkdown]");
    expect(promptDraftSource).toContain("draft !== task.promptMarkdown");
    expect(promptDraftSource).toContain("window.setTimeout(() =>");
    expect(promptDraftSource).toContain("void handlePromptSave(taskId)");
    expect(promptDraftSource).not.toContain("[task.taskId, task.promptPreview]");
  });

  it("keeps desktop project loading and file watching inside the project hook", async () => {
    const [appSource, projectHookSource] = await Promise.all([
      readFile(resolve(sourceDir, "renderer", "App.tsx"), "utf8"),
      readFile(resolve(sourceDir, "renderer", "hooks", "useDesktopProject.ts"), "utf8")
    ]);

    expect(appSource).toContain("useDesktopProject({");
    expect(projectHookSource).toContain(".listProjects()");
    expect(projectHookSource).toContain("bridge.getGraphViewModel(project.rootPath)");
    expect(projectHookSource).toContain("bridge.getDesktopLayout(project.rootPath)");
    expect(projectHookSource).toContain("bridge.getTodoGroups(project.rootPath)");
    expect(projectHookSource).toContain("bridge.getStatistics(project.rootPath)");
    expect(projectHookSource).toContain("bridge.watchPackageFiles(project.rootPath)");
    expect(projectHookSource).toContain("bridge.unwatchPackageFiles(projectRoot)");
  });
});
