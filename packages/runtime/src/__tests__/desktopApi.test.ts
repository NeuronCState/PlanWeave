import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  addBlock,
  addContextNode,
  addDependencyEdge,
  addTaskNode,
  createDesktopPackageFileSnapshot,
  createTaskDraft,
  detectDesktopPackageFileChanges,
  getBlockDetail,
  getDesktopLayout,
  getDirtyPromptRefs,
  getFeedbackRecords,
  getGraphViewModel,
  getReviewAttempts,
  getReviewPipeline,
  getRunRecord,
  getStatistics,
  getTaskDetail,
  getTaskExecutionOrder,
  getTodoGroups,
  getAutoRunState,
  getLatestAutoRunSummary,
  listBlockRunRecords,
  listProjects,
  pauseAutoRun,
  refreshChangedDesktopPackagePrompts,
  refreshPackageFileChanges,
  removeBlock,
  removeDependencyEdge,
  removeTaskNode,
  resumeAutoRun,
  resetDesktopLayout,
  saveDesktopLayout,
  searchProject,
  startAutoRun,
  stopAutoRun,
  updateBlockExecutor,
  updateBlockPrompt,
  updateBlockTitle,
  updateTaskExecutor,
  updateTaskPrompt,
  updateTaskTitle,
  updateReviewPipeline,
  validateGraphEdit
} from "../desktop/index.js";
import { readJsonFile, writeJsonFile } from "../json.js";
import { claimNext, submitBlockResult, submitReviewResult } from "../taskManager/index.js";
import type { PlanPackageManifest } from "../types.js";
import { basicManifest, createTestWorkspace, writeReport, writeReviewResult } from "./promptTestHelpers.js";

afterEach(() => {
  delete process.env.PLANWEAVE_HOME;
});

describe("desktop runtime API", () => {
  it("lists projects and returns graph view models with source prompt previews and block order", async () => {
    const { root, init } = await createTestWorkspace();
    const projects = await listProjects();
    expect(projects).toEqual([
      expect.objectContaining({
        projectId: init.workspace.id,
        rootPath: init.workspace.rootPath
      })
    ]);

    const graph = await getGraphViewModel(root);

    expect(graph.projectId).toBe(init.workspace.id);
    expect(graph.projectTitle).toBe("Test Plan");
    expect(graph.executorOptions).toEqual(expect.arrayContaining(["default", "manual", "codex-auto", "codex-reviewer"]));
    expect(graph.edges).toContainEqual({ from: "T-001", to: "G-001", type: "implements" });
    expect(graph.tasks[0]).toMatchObject({
      taskId: "T-001",
      title: "Implement test task",
      status: "ready",
      executorLabel: "manual",
      overflowBlockCount: 0
    });
    expect(graph.tasks[0].promptPreview).toContain("T-001 task prompt");
    expect(graph.tasks[0].blockPreview.map((block) => block.ref)).toEqual(["T-001#B-001", "T-001#C-001", "T-001#R-001"]);
  });

  it("writes task/block titles, executor overrides, and task dependency edges through the manifest", async () => {
    const { root, init } = await createTestWorkspace(basicManifest({ includeSecondTask: true }));

    await expect(updateTaskTitle(root, "T-001", "Updated task title")).resolves.toMatchObject({ ok: true });
    await expect(updateTaskExecutor(root, "T-001", "codex-auto")).resolves.toMatchObject({ ok: true });
    await expect(updateBlockTitle(root, "T-001#B-001", "Updated block title")).resolves.toMatchObject({ ok: true });
    await expect(updateBlockExecutor(root, "T-001#B-001", "manual")).resolves.toMatchObject({ ok: true });
    await expect(addDependencyEdge(root, "T-001", "T-002")).resolves.toMatchObject({ ok: true, affectedTasks: ["T-001"] });

    let manifest = await readJsonFile<PlanPackageManifest>(init.workspace.manifestFile);
    const task = manifest.nodes.find((node) => node.type === "task" && node.id === "T-001");
    if (task?.type !== "task") {
      throw new Error("Fixture task missing.");
    }
    expect(task.title).toBe("Updated task title");
    expect(task.executor).toBe("codex-auto");
    expect(task.blocks.find((block) => block.id === "B-001")).toMatchObject({
      title: "Updated block title",
      executor: "manual"
    });
    expect(manifest.edges).toContainEqual({ from: "T-001", to: "T-002", type: "depends_on" });

    const cyclic = await addDependencyEdge(root, "T-002", "T-001");
    expect(cyclic.ok).toBe(false);
    expect(cyclic.diagnostics.map((diagnostic) => diagnostic.code)).toContain("depends_on_cycle");
    manifest = await readJsonFile<PlanPackageManifest>(init.workspace.manifestFile);
    expect(manifest.edges).not.toContainEqual({ from: "T-002", to: "T-001", type: "depends_on" });

    await expect(updateBlockExecutor(root, "T-001#B-001", null)).resolves.toMatchObject({ ok: true });
    await expect(removeDependencyEdge(root, "T-001", "T-002")).resolves.toMatchObject({ ok: true });
    manifest = await readJsonFile<PlanPackageManifest>(init.workspace.manifestFile);
    const updatedTask = manifest.nodes.find((node) => node.type === "task" && node.id === "T-001");
    if (updatedTask?.type !== "task") {
      throw new Error("Fixture task missing.");
    }
    expect(updatedTask.blocks.find((block) => block.id === "B-001")).not.toHaveProperty("executor");
    expect(manifest.edges).not.toContainEqual({ from: "T-001", to: "T-002", type: "depends_on" });
  });

  it("validates graph edits without writing the manifest", async () => {
    const { root, init } = await createTestWorkspace(basicManifest({ includeSecondTask: true, taskDependsOn: ["T-002"] }));

    const invalid = await validateGraphEdit(root, {
      kind: "addDependencyEdge",
      fromTaskId: "T-002",
      toTaskId: "T-001"
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.diagnostics.map((diagnostic) => diagnostic.code)).toContain("depends_on_cycle");

    let manifest = await readJsonFile<PlanPackageManifest>(init.workspace.manifestFile);
    expect(manifest.edges).not.toContainEqual({ from: "T-002", to: "T-001", type: "depends_on" });

    await expect(
      validateGraphEdit(root, {
        kind: "removeBlock",
        blockRef: "T-001#C-001"
      })
    ).resolves.toMatchObject({ ok: true, affectedTasks: ["T-001"] });
    manifest = await readJsonFile<PlanPackageManifest>(init.workspace.manifestFile);
    const firstTask = manifest.nodes.find((node) => node.type === "task" && node.id === "T-001");
    if (firstTask?.type !== "task") {
      throw new Error("Fixture task missing.");
    }
    expect(firstTask.blocks.map((block) => block.id)).toEqual(["B-001", "C-001", "R-001"]);
  });

  it("creates task drafts and writes new task nodes and blocks through package files", async () => {
    const { root, init } = await createTestWorkspace();

    const draft = await createTaskDraft(root, {
      mode: "task",
      text: "# Add export flow\n\nUsers can export the current plan."
    });
    expect(draft).toMatchObject({
      mode: "task",
      tasks: [
        {
          title: "Add export flow",
          blockTypes: ["implementation", "check", "review"]
        }
      ]
    });

    await expect(addTaskNode(root, draft.tasks[0])).resolves.toMatchObject({ ok: true });
    let manifest = await readJsonFile<PlanPackageManifest>(init.workspace.manifestFile);
    const createdTask = manifest.nodes.find((node) => node.type === "task" && node.title === "Add export flow");
    if (createdTask?.type !== "task") {
      throw new Error("Created task missing.");
    }
    expect(createdTask.id).toBe("T-ADD-EXPORT-FLOW");
    expect(createdTask.blocks.map((block) => block.type)).toEqual(["implementation", "check", "review"]);
    expect(createdTask.blocks.map((block) => block.depends_on)).toEqual([[], ["B-001"], ["C-001"]]);
    expect(await readFile(join(init.workspace.packageDir, createdTask.prompt), "utf8")).toContain("Users can export");
    expect(await readFile(join(init.workspace.packageDir, createdTask.blocks[0].prompt), "utf8")).toContain("Add export flow");

    await expect(
      addBlock(root, {
        taskId: createdTask.id,
        type: "check",
        title: "Check export",
        promptMarkdown: "# Check export\n"
      })
    ).resolves.toMatchObject({ ok: true });
    manifest = await readJsonFile<PlanPackageManifest>(init.workspace.manifestFile);
    const updatedTask = manifest.nodes.find((node) => node.type === "task" && node.id === createdTask.id);
    if (updatedTask?.type !== "task") {
      throw new Error("Updated task missing.");
    }
    const addedBlock = updatedTask.blocks.at(-1);
    expect(addedBlock).toMatchObject({
      id: "C-002",
      type: "check",
      title: "Check export",
      depends_on: ["R-001"]
    });
    expect(await readFile(join(init.workspace.packageDir, addedBlock?.prompt ?? ""), "utf8")).toBe("# Check export\n");

    const appendDraft = await createTaskDraft(root, {
      mode: "blocks",
      targetTaskId: createdTask.id,
      text: "Add a follow-up validation block."
    });
    expect(appendDraft.blocks).toMatchObject([{ taskId: createdTask.id, type: "implementation", title: "Add a follow-up validation block." }]);
  });

  it("creates context nodes through the desktop graph API", async () => {
    const { root, init } = await createTestWorkspace();

    await expect(
      addContextNode(root, {
        type: "component",
        title: "Desktop Renderer",
        summary: "The Electron renderer workspace."
      })
    ).resolves.toMatchObject({ ok: true, affectedTasks: [] });

    const manifest = await readJsonFile<PlanPackageManifest>(init.workspace.manifestFile);
    expect(manifest.nodes).toContainEqual({
      id: "CMP-DESKTOP-RENDERER",
      type: "component",
      title: "Desktop Renderer",
      summary: "The Electron renderer workspace."
    });
    await expect(getGraphViewModel(root)).resolves.toMatchObject({
      contextNodes: [
        expect.objectContaining({
          nodeId: "G-001",
          type: "goal"
        }),
        expect.objectContaining({
          nodeId: "CMP-DESKTOP-RENDERER",
          type: "component",
          title: "Desktop Renderer"
        })
      ]
    });
  });

  it("updates review pipeline steps through generic review blocks", async () => {
    const { root, init } = await createTestWorkspace();

    const pipeline = await getReviewPipeline(root, "T-001");
    expect(pipeline).toMatchObject({
      taskId: "T-001",
      packageDefaults: { maxFeedbackCycles: 1, completionPolicy: "strict" },
      steps: [
        expect.objectContaining({
          blockRef: "T-001#R-001",
          enabled: true,
          preset: "general",
          triggerCondition: "after_required_work_completed"
        })
      ]
    });

    await expect(
      updateReviewPipeline(root, "T-001", {
        packageDefaults: {
          maxFeedbackCycles: 3,
          completionPolicy: "strict"
        },
        steps: [
          {
            ...pipeline.steps[0],
            title: "Architecture review",
            enabled: false,
            preset: "architecture",
            triggerCondition: "manual",
            inputContext: "implementation reports and changed files",
            passCriteria: "Architecture boundaries remain clear.",
            feedbackFormat: "Concrete changes by file.",
            maxFeedbackCycles: 2,
            promptMarkdown: "# Architecture review\n"
          },
          {
            blockId: "",
            title: "Security review",
            enabled: true,
            preset: "security",
            triggerCondition: "after_required_work_completed",
            inputContext: "implementation reports",
            passCriteria: "No obvious security regression.",
            feedbackFormat: "Security findings with severity.",
            maxFeedbackCycles: 1,
            hook: {
              id: "security-hook",
              type: "executable",
              command: "node",
              args: ["security-check.js"],
              executionPolicy: "trusted-local"
            },
            promptMarkdown: "# Security review\n"
          }
        ]
      })
    ).resolves.toMatchObject({ ok: true, affectedTasks: ["T-001"] });

    const manifest = await readJsonFile<PlanPackageManifest>(init.workspace.manifestFile);
    expect(manifest.review).toEqual({ maxFeedbackCycles: 3, completionPolicy: "strict" });
    const task = manifest.nodes.find((node) => node.type === "task" && node.id === "T-001");
    if (task?.type !== "task") {
      throw new Error("Fixture task missing.");
    }
    const reviews = task.blocks.filter((block) => block.type === "review");
    expect(reviews).toHaveLength(2);
    expect(reviews[0]).toMatchObject({
      id: "R-001",
      title: "Architecture review",
      depends_on: ["C-001"],
      review: {
        required: false,
        maxFeedbackCycles: 2,
        preset: "architecture",
        triggerCondition: "manual",
        passCriteria: "Architecture boundaries remain clear."
      }
    });
    expect(reviews[1]).toMatchObject({
      id: "R-002",
      title: "Security review",
      depends_on: ["R-001"],
      review: {
        required: true,
        hook: { id: "security-hook", command: "node" }
      }
    });
    await expect(readFile(join(init.workspace.packageDir, "nodes", "T-001", "blocks", "R-001.prompt.md"), "utf8")).resolves.toBe(
      "# Architecture review\n"
    );
    await expect(readFile(join(init.workspace.packageDir, "nodes", "T-001", "blocks", "R-002.prompt.md"), "utf8")).resolves.toBe(
      "# Security review\n"
    );
  });

  it("returns task-local execution order and removes task/block package surfaces through graph APIs", async () => {
    const { root, init } = await createTestWorkspace(basicManifest({ includeSecondTask: true }));

    await expect(getTaskExecutionOrder(root, "T-001")).resolves.toEqual({
      taskId: "T-001",
      blockRefs: ["T-001#B-001", "T-001#C-001", "T-001#R-001"]
    });

    await expect(removeBlock(root, "T-001#C-001")).resolves.toMatchObject({ ok: true, affectedTasks: ["T-001"] });
    let manifest = await readJsonFile<PlanPackageManifest>(init.workspace.manifestFile);
    let firstTask = manifest.nodes.find((node) => node.type === "task" && node.id === "T-001");
    if (firstTask?.type !== "task") {
      throw new Error("Fixture task missing.");
    }
    expect(firstTask.blocks.map((block) => block.id)).toEqual(["B-001", "R-001"]);
    expect(firstTask.blocks.find((block) => block.id === "R-001")?.depends_on).toEqual([]);
    await expect(readFile(join(init.workspace.packageDir, "nodes", "T-001", "blocks", "C-001.prompt.md"), "utf8")).rejects.toThrow();

    await expect(removeTaskNode(root, "T-002")).resolves.toMatchObject({ ok: true });
    manifest = await readJsonFile<PlanPackageManifest>(init.workspace.manifestFile);
    expect(manifest.nodes.some((node) => node.id === "T-002")).toBe(false);
    expect(manifest.edges.some((edge) => edge.from === "T-002" || edge.to === "T-002")).toBe(false);
    await expect(readFile(join(init.workspace.packageDir, "nodes", "T-002", "prompt.md"), "utf8")).rejects.toThrow();
  });

  it("reads details and writes task/block source prompts through package files", async () => {
    const { root, init } = await createTestWorkspace();

    const longTaskPrompt = `# Updated task prompt\n\n${"Long source prompt content. ".repeat(20)}`;
    await updateTaskPrompt(root, "T-001", longTaskPrompt);
    await updateBlockPrompt(root, "T-001#B-001", "# Updated block prompt\n");

    const manifest = await readJsonFile<PlanPackageManifest>(init.workspace.manifestFile);
    const task = manifest.nodes.find((node) => node.type === "task" && node.id === "T-001");
    if (task?.type !== "task") {
      throw new Error("Fixture task missing.");
    }
    expect(task.title).toBe("Implement test task");
    expect(task.blocks.find((block) => block.id === "B-001")?.title).toBe("Implement task");
    expect(await readFile(join(init.workspace.packageDir, "nodes", "T-001", "prompt.md"), "utf8")).toBe(longTaskPrompt);
    expect(await readFile(join(init.workspace.packageDir, "nodes", "T-001", "blocks", "B-001.prompt.md"), "utf8")).toBe(
      "# Updated block prompt\n"
    );

    await expect(getTaskDetail(root, "T-001")).resolves.toMatchObject({
      title: "Implement test task",
      promptMarkdown: longTaskPrompt
    });
    const graph = await getGraphViewModel(root);
    expect(graph.tasks[0].promptMarkdown).toBe(longTaskPrompt);
    expect(graph.tasks[0].promptPreview.length).toBeLessThan(graph.tasks[0].promptMarkdown.length);
    await expect(getBlockDetail(root, "T-001#B-001")).resolves.toMatchObject({
      title: "Implement task",
      promptMarkdown: "# Updated block prompt\n"
    });
  });

  it("stores desktop layout outside the Plan Package", async () => {
    const { root, init } = await createTestWorkspace();

    expect(await getDesktopLayout(root)).toMatchObject({ nodes: [] });
    const saved = await saveDesktopLayout(root, {
      version: "desktop-layout/v1",
      projectId: "ignored",
      nodes: [
        { nodeId: "T-001", x: 120, y: 240 },
        { nodeId: "G-001", x: 300, y: 420 }
      ],
      updatedAt: new Date(0).toISOString()
    });

    expect(saved.projectId).toBe(init.workspace.id);
    expect(await getDesktopLayout(root)).toMatchObject({
      projectId: init.workspace.id,
      nodes: [
        { nodeId: "T-001", x: 120, y: 240 },
        { nodeId: "G-001", x: 300, y: 420 }
      ]
    });
    expect(await readJsonFile<PlanPackageManifest>(init.workspace.manifestFile)).not.toHaveProperty("layout");
    expect(await resetDesktopLayout(root)).toMatchObject({ projectId: init.workspace.id, nodes: [] });
  });

  it("keeps package file snapshots inside runtime and returns serializable dirty prompt refs", async () => {
    const { root, init } = await createTestWorkspace();

    const snapshot = await createDesktopPackageFileSnapshot(root);
    expect(snapshot).toMatchObject({
      projectRoot: root,
      promptFileCount: 4
    });
    expect(snapshot.snapshotId).toMatch(/^PKG-SNAPSHOT-/);

    await expect(detectDesktopPackageFileChanges(root, snapshot.snapshotId)).resolves.toMatchObject({
      ok: true,
      primed: false,
      dirtyPromptRefs: []
    });
    await writeFile(join(init.workspace.packageDir, "nodes", "T-001", "blocks", "B-001.prompt.md"), "# external edit\n", "utf8");

    await expect(detectDesktopPackageFileChanges(root, snapshot.snapshotId)).resolves.toMatchObject({
      ok: true,
      primed: false,
      fullRefresh: true,
      affectedTasks: ["T-001"],
      dirtyPromptRefs: ["T-001#B-001"]
    });
    await expect(getDirtyPromptRefs(root)).resolves.toEqual(["T-001#B-001"]);

    await expect(refreshChangedDesktopPackagePrompts(root, snapshot.snapshotId)).resolves.toMatchObject({
      ok: true,
      primed: false,
      fullRefresh: true,
      affectedTasks: ["T-001"],
      dirtyPromptRefs: ["T-001#B-001"]
    });
    await expect(refreshPackageFileChanges(root)).resolves.toMatchObject({
      ok: true,
      primed: false,
      dirtyPromptRefs: []
    });
  });

  it("starts, pauses, resumes, stops, and summarizes project-level Auto Run", async () => {
    const manifest = basicManifest() as any;
    manifest.executors = {
      "fake-codex": {
        adapter: "codex-exec",
        command: process.execPath,
        args: [
          "-e",
          "let input=''; process.stdin.on('data', c => input += c); process.stdin.on('end', () => { console.log('desktop auto run ' + input.split('\\n')[0]); });"
        ]
      }
    };
    manifest.execution.defaultExecutor = "fake-codex";
    const { root } = await createTestWorkspace(manifest);

    const started = await startAutoRun(root, { kind: "project" }, 1);
    expect(started.phase).toBe("running");

    let current = await getAutoRunState(started.runId);
    for (let attempt = 0; attempt < 20 && current.phase === "running"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      current = await getAutoRunState(started.runId);
    }

    expect(current).toMatchObject({
      phase: "paused",
      stepCount: 1,
      currentExecutor: "fake-codex",
      error: "Step limit reached."
    });
    expect(current.startedAt).toEqual(expect.any(String));
    expect(current.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(current.latestOutputSummary).toContain("desktop auto run");
    expect(current.latestRecordId).toBe("T-001#B-001::RUN-001");
    expect(current.latestRecordPath).toContain("metadata.json");
    await expect(getLatestAutoRunSummary(root)).resolves.toMatchObject({ runId: started.runId });

    await expect(resumeAutoRun(started.runId)).resolves.toMatchObject({ phase: "running" });
    await expect(pauseAutoRun(started.runId)).resolves.toMatchObject({ phase: "paused" });
    await expect(stopAutoRun(started.runId)).resolves.toMatchObject({ phase: "stopped" });
  });

  it("runs selected task and selected block Auto Run through the Task Manager claim order", async () => {
    const manifest = basicManifest({ includeSecondTask: true }) as any;
    manifest.executors = {
      "fake-codex": {
        adapter: "codex-exec",
        command: process.execPath,
        args: [
          "-e",
          "let input=''; process.stdin.on('data', c => input += c); process.stdin.on('end', () => { console.log('scoped auto run ' + input.split('\\n')[0]); });"
        ]
      }
    };
    manifest.execution.defaultExecutor = "fake-codex";
    const { root } = await createTestWorkspace(manifest);

    const taskRun = await startAutoRun(root, { kind: "task", taskId: "T-002" }, 1);
    let taskState = await getAutoRunState(taskRun.runId);
    for (let attempt = 0; attempt < 20 && taskState.phase === "running"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      taskState = await getAutoRunState(taskRun.runId);
    }
    expect(taskState).toMatchObject({
      scope: { kind: "task", taskId: "T-002" },
      phase: "paused",
      currentRef: "T-002#B-001",
      currentExecutor: "fake-codex",
      stepCount: 1
    });

    const blockRun = await startAutoRun(root, { kind: "block", blockRef: "T-001#B-001" }, 1);
    let blockState = await getAutoRunState(blockRun.runId);
    for (let attempt = 0; attempt < 20 && blockState.phase === "running"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      blockState = await getAutoRunState(blockRun.runId);
    }
    expect(blockState).toMatchObject({
      scope: { kind: "block", blockRef: "T-001#B-001" },
      phase: "paused",
      currentRef: "T-001#B-001",
      currentExecutor: "fake-codex",
      stepCount: 1
    });
  });

  it("derives todo, statistics, and search from runtime/package sources", async () => {
    const { root, init } = await createTestWorkspace(basicManifest({ includeSecondTask: true, taskDependsOn: ["T-002"] }));
    const manifest = await readJsonFile<PlanPackageManifest>(init.workspace.manifestFile);
    const firstTask = manifest.nodes.find((node) => node.type === "task" && node.id === "T-001");
    if (firstTask?.type !== "task") {
      throw new Error("Fixture task missing.");
    }
    firstTask.blocks[0] = { ...firstTask.blocks[0], executor: "codex-auto" };
    await writeJsonFile(init.workspace.manifestFile, manifest);

    const todo = await getTodoGroups(root);
    expect(todo.ready.map((item) => item.ref)).toEqual(["T-002#B-001"]);
    expect(todo.planned.find((item) => item.ref === "T-001#B-001")?.dependencyBlockers).toEqual(["T-002"]);

    const stats = await getStatistics(root);
    expect(stats.taskTotal).toBe(2);
    expect(stats.estimatedRemainingBlocks).toBe(5);
    expect(stats).toMatchObject({
      taskThroughput: 0,
      implementedRatio: 0,
      averageImplementationTimeMs: null,
      reviewPassedRatio: 0,
      reworkCount: 0
    });

    const search = await searchProject(root, "T-001 task prompt");
    expect(search).toContainEqual(expect.objectContaining({ kind: "prompt", ref: "T-001" }));
    await expect(searchProject(root, "T-001 task prompt", { kinds: ["prompt"] })).resolves.toEqual([
      expect.objectContaining({ kind: "prompt", ref: "T-001", targetRef: "T-001" })
    ]);
    await expect(searchProject(root, "T-001 task prompt", { kinds: ["task"] })).resolves.toEqual([]);

    const graph = await getGraphViewModel(root);
    expect(graph.tasks.find((task) => task.taskId === "T-001")?.executorLabel).toBe("Mixed");
  });

  it("groups blocks under implemented once their task is implemented", async () => {
    const { root } = await createTestWorkspace();

    await claimNext({ projectRoot: root });
    await submitBlockResult({ projectRoot: root, ref: "T-001#B-001", reportPath: await writeReport(root, "implemented-b.md") });
    await claimNext({ projectRoot: root });
    await submitBlockResult({ projectRoot: root, ref: "T-001#C-001", reportPath: await writeReport(root, "implemented-c.md") });
    await claimNext({ projectRoot: root });
    await submitReviewResult({
      projectRoot: root,
      ref: "T-001#R-001",
      resultPath: await writeReviewResult(root, "passed", "ready to ship")
    });

    const todo = await getTodoGroups(root);
    expect(todo.implemented.map((item) => item.ref)).toEqual(["T-001#B-001", "T-001#C-001", "T-001#R-001"]);
    expect(todo.completed).toEqual([]);
  });

  it("searches run records, review attempts, and feedback records from runtime results/state", async () => {
    const { root } = await createTestWorkspace();
    await claimNext({ projectRoot: root });
    await submitBlockResult({
      projectRoot: root,
      ref: "T-001#B-001",
      reportPath: await writeReport(root, "run-record.md", "desktop run record needle\n")
    });
    await claimNext({ projectRoot: root });
    await submitBlockResult({
      projectRoot: root,
      ref: "T-001#C-001",
      reportPath: await writeReport(root, "check-record.md", "check complete\n")
    });
    await claimNext({ projectRoot: root });
    await submitReviewResult({
      projectRoot: root,
      ref: "T-001#R-001",
      resultPath: await writeReviewResult(root, "needs_changes", "desktop feedback needle")
    });

    await expect(listBlockRunRecords(root, "T-001#B-001")).resolves.toEqual([
      expect.objectContaining({
        ref: "T-001#B-001",
        recordId: "T-001#B-001::RUN-001",
        taskId: "T-001",
        blockId: "B-001",
        runId: "RUN-001",
        reportPath: expect.stringContaining("report.md")
      })
    ]);
    await expect(getRunRecord(root, "T-001#B-001::RUN-001")).resolves.toMatchObject({
      recordId: "T-001#B-001::RUN-001",
      ref: "T-001#B-001",
      runId: "RUN-001",
      reportMarkdown: "desktop run record needle\n"
    });
    await expect(getReviewAttempts(root, "T-001#R-001")).resolves.toEqual([
      expect.objectContaining({
        ref: "T-001#R-001",
        attemptId: "REV-001",
        verdict: "needs_changes",
        contentPreview: "desktop feedback needle"
      })
    ]);
    await expect(getFeedbackRecords(root, "T-001#R-001")).resolves.toEqual([
      expect.objectContaining({
        feedbackId: "FE-001",
        sourceReviewBlockRef: "T-001#R-001",
        status: "open",
        content: "desktop feedback needle"
      })
    ]);

    expect(await searchProject(root, "run record needle")).toContainEqual(
      expect.objectContaining({
        kind: "run_record",
        ref: expect.stringContaining("report.md"),
        recordId: "T-001#B-001::RUN-001",
        path: expect.stringContaining("report.md")
      })
    );
    expect(await searchProject(root, "feedback needle")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "review_attempt", ref: expect.stringContaining("review-result.json"), targetRef: "T-001#R-001" }),
        expect.objectContaining({ kind: "feedback", ref: "FE-001", targetRef: "T-001#R-001" })
      ])
    );
  });
});
