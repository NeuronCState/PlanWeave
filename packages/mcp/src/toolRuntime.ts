import {
  addCanvasDependency,
  addBlock,
  addCrossTaskDependency,
  addDependencyEdge,
  addTaskNode,
  createTaskCanvas,
  getBlockDetail,
  getGraphViewModel,
  getReviewPipeline,
  getTaskDetail,
  initOrOpenProject,
  listProjects,
  listTaskCanvases,
  openProject,
  readProjectPrompt,
  refreshPrompts,
  removeBlock,
  removeCanvasDependency,
  removeCrossTaskDependency,
  removeDependencyEdge,
  removeTaskNode,
  resolveTaskCanvasWorkspace,
  runtimeSchemaDocuments,
  updateBlockDependencies,
  updateBlockExecutor,
  updateBlockPlanning,
  updateBlockPrompt,
  updateBlockTitle,
  updateProjectPrompt,
  updateReviewPipeline,
  updateTaskAcceptance,
  updateTaskExecutor,
  updateTaskPrompt,
  updateTaskTitle,
  validatePackage
} from "@planweave-ai/runtime";
import type { GraphEditResult } from "@planweave-ai/runtime";
import { exportCanvasPackage, importPackageFiles, managedProjectRoot } from "./toolPackageFiles.js";
import type { RuntimeGateway } from "./toolTypes.js";

const managedProjectsDir = "mcp-projects";

export const runtimeGateway: RuntimeGateway = {
  getSchemaDocuments() {
    return runtimeSchemaDocuments;
  },
  async initProject(name) {
    return initOrOpenProject(await managedProjectRoot(managedProjectsDir, name));
  },
  async createCanvas(projectId, name) {
    return createTaskCanvas(await resolveProjectRoot(projectId), { name });
  },
  async listProjects() {
    return listProjects();
  },
  async openProject(projectId) {
    await resolveProjectRoot(projectId);
    return openProject({ projectId });
  },
  async validateProject(projectId) {
    return validatePackage({ projectRoot: await resolveProjectRoot(projectId) });
  },
  async getProjectOverview(projectId) {
    return openProject({ projectId });
  },
  async getProjectGraph(projectId, canvasId) {
    return getGraphViewModel(await resolveCanvasWorkspace(projectId, canvasId));
  },
  async getTaskDetail(projectId, taskId, canvasId) {
    return getTaskDetail(await resolveCanvasWorkspace(projectId, canvasId), taskId);
  },
  async getBlockDetail(projectId, blockRef, canvasId) {
    return getBlockDetail(await resolveCanvasWorkspace(projectId, canvasId), blockRef);
  },
  async getReviewPipeline(projectId, taskId, canvasId) {
    return getReviewPipeline(await resolveCanvasWorkspace(projectId, canvasId), taskId);
  },
  async updateReviewPipeline(projectId, canvasId, taskId, input) {
    return updateReviewPipeline(await resolveCanvasWorkspace(projectId, canvasId), taskId, input);
  },
  async createTask(projectId, canvasId, input) {
    return addTaskNode(await resolveCanvasWorkspace(projectId, canvasId), input);
  },
  async updateTask(projectId, canvasId, taskId, input) {
    let result: GraphEditResult | null = null;
    const workspace = await resolveCanvasWorkspace(projectId, canvasId);
    if (input.title !== undefined) {
      result = await updateTaskTitle(workspace, taskId, input.title);
    }
    if (input.promptMarkdown !== undefined) {
      result = await updateTaskPrompt(workspace, taskId, input.promptMarkdown);
    }
    if (Object.prototype.hasOwnProperty.call(input, "executor")) {
      result = await updateTaskExecutor(workspace, taskId, input.executor ?? null);
    }
    if (!result) {
      throw new Error("At least one of title, promptMarkdown, or executor must be provided.");
    }
    return result;
  },
  async updateTaskAcceptance(projectId, canvasId, taskId, acceptance) {
    return updateTaskAcceptance(await resolveCanvasWorkspace(projectId, canvasId), taskId, acceptance);
  },
  async removeTask(projectId, canvasId, taskId) {
    return removeTaskNode(await resolveCanvasWorkspace(projectId, canvasId), taskId);
  },
  async createBlock(projectId, canvasId, input) {
    return addBlock(await resolveCanvasWorkspace(projectId, canvasId), input);
  },
  async updateBlock(projectId, canvasId, blockRef, input) {
    let result: GraphEditResult | null = null;
    const workspace = await resolveCanvasWorkspace(projectId, canvasId);
    if (input.title !== undefined) {
      result = await updateBlockTitle(workspace, blockRef, input.title);
    }
    if (input.promptMarkdown !== undefined) {
      result = await updateBlockPrompt(workspace, blockRef, input.promptMarkdown);
    }
    if (Object.prototype.hasOwnProperty.call(input, "executor")) {
      result = await updateBlockExecutor(workspace, blockRef, input.executor ?? null);
    }
    if (!result) {
      throw new Error("At least one of title, promptMarkdown, or executor must be provided.");
    }
    return result;
  },
  async updateBlockPlanning(projectId, canvasId, blockRef, input) {
    return updateBlockPlanning(await resolveCanvasWorkspace(projectId, canvasId), blockRef, input);
  },
  async updateBlockDependencies(projectId, canvasId, blockRef, dependsOn) {
    return updateBlockDependencies(await resolveCanvasWorkspace(projectId, canvasId), blockRef, dependsOn);
  },
  async removeBlock(projectId, canvasId, blockRef) {
    return removeBlock(await resolveCanvasWorkspace(projectId, canvasId), blockRef);
  },
  async addDependency(projectId, canvasId, fromTaskId, toTaskId) {
    return addDependencyEdge(await resolveCanvasWorkspace(projectId, canvasId), fromTaskId, toTaskId);
  },
  async removeDependency(projectId, canvasId, fromTaskId, toTaskId) {
    return removeDependencyEdge(await resolveCanvasWorkspace(projectId, canvasId), fromTaskId, toTaskId);
  },
  async addCanvasDependency(projectId, fromCanvasId, toCanvasId) {
    return addCanvasDependency(await resolveProjectRoot(projectId), fromCanvasId, toCanvasId);
  },
  async removeCanvasDependency(projectId, fromCanvasId, toCanvasId) {
    return removeCanvasDependency(await resolveProjectRoot(projectId), fromCanvasId, toCanvasId);
  },
  async addCrossTaskDependency(projectId, from, to) {
    return addCrossTaskDependency(await resolveProjectRoot(projectId), from, to);
  },
  async removeCrossTaskDependency(projectId, from, to) {
    return removeCrossTaskDependency(await resolveProjectRoot(projectId), from, to);
  },
  async readProjectPrompt(projectId) {
    return readProjectPrompt(await resolveProjectRoot(projectId));
  },
  async updateProjectPrompt(projectId, markdown) {
    return updateProjectPrompt(await resolveProjectRoot(projectId), markdown);
  },
  async refreshPrompts(projectId, canvasId) {
    return refreshPrompts({ projectRoot: await resolveCanvasWorkspace(projectId, canvasId) });
  },
  async exportPlanPackage(projectId, canvasId) {
    return exportCanvasPackage(projectId, canvasId);
  },
  async exportProject(projectId) {
    const project = await openProject({ projectId });
    const canvases = await listTaskCanvases(project.rootPath);
    return {
      project,
      projectPromptMarkdown: await readProjectPrompt(project.rootPath),
      planPackages: await Promise.all(canvases.map((canvas) => exportCanvasPackage(projectId, canvas.canvasId)))
    };
  },
  async importPlanPackage(input) {
    return importPackageFiles(input.name, input.files, input.overwrite ?? false);
  }
};

async function resolveProjectRoot(projectId: string): Promise<string> {
  const project = (await listProjects()).find((item) => item.projectId === projectId);
  if (!project) {
    throw new Error(`Project '${projectId}' is not registered in PlanWeave.`);
  }
  return project.rootPath;
}

async function resolveCanvasWorkspace(projectId: string, canvasId?: string) {
  const project = await openProject({ projectId });
  return resolveTaskCanvasWorkspace(project.rootPath, canvasId);
}
