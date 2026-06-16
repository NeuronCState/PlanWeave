import { loadPackage, resolvePackageWorkspace } from "../package/loadPackage.js";
import type {
  ExecutorAdapter,
  ExecutorProfile,
  ExecutorProfileSummary,
  ManifestTaskNode,
  PackageWorkspaceRef,
  PlanPackageManifest
} from "../types.js";
import { claudeCodeIntegration } from "./claudeCodeIntegration.js";
import { codexIntegration } from "./codexIntegration.js";
import { execWithStdin, type BlockClaim } from "./executorShared.js";
import type { ExecutorIntegration, ExecutorRuntimeOptions } from "./executorIntegration.js";
import { localReviewIntegration } from "./localReviewIntegration.js";
import { manualIntegration } from "./manualExecutor.js";
import { opencodeIntegration } from "./opencodeIntegration.js";
import { piIntegration } from "./piIntegration.js";

const executorIntegrations: ExecutorIntegration[] = [
  manualIntegration,
  codexIntegration,
  opencodeIntegration,
  claudeCodeIntegration,
  piIntegration,
  localReviewIntegration
];

const builtinExecutors: Record<string, ExecutorProfile> = Object.assign({}, ...executorIntegrations.map((integration) => integration.builtinProfiles));

function integrationForAdapter(adapter: ExecutorProfile["adapter"]): ExecutorIntegration {
  const integration = executorIntegrations.find((item) => item.adapter === adapter);
  if (!integration) {
    throw new Error(`Executor adapter '${adapter}' is not supported.`);
  }
  return integration;
}

function taskNodeForClaim(manifest: PlanPackageManifest, claim: BlockClaim): ManifestTaskNode {
  const node = manifest.nodes.find((item) => item.type === "task" && item.id === claim.taskId);
  if (node?.type !== "task") {
    throw new Error(`Task '${claim.taskId}' does not exist.`);
  }
  return node;
}

function resolveBlockExecutorName(manifest: PlanPackageManifest, claim: BlockClaim, override?: string): string {
  const task = taskNodeForClaim(manifest, claim);
  const block = task.blocks.find((item) => item.id === claim.blockId);
  if (!block) {
    throw new Error(`Block '${claim.ref}' does not exist.`);
  }
  return override ?? block.executor ?? task.executor ?? manifest.execution.defaultExecutor ?? "default";
}

function profilesByName(manifest: PlanPackageManifest): Record<string, ExecutorProfile> {
  return {
    ...builtinExecutors,
    ...(manifest.executors ?? {})
  };
}

async function resolveProfileForClaim(options: {
  projectRoot: PackageWorkspaceRef;
  claim: BlockClaim;
  executorName?: string;
}): Promise<{ name: string; profile: ExecutorProfile }> {
  const { manifest } = await loadPackage(options.projectRoot);
  const name = resolveBlockExecutorName(manifest, options.claim, options.executorName);
  const profile = profilesByName(manifest)[name];
  if (!profile) {
    throw new Error(`Executor profile '${name}' does not exist.`);
  }
  return { name, profile };
}

function createProfiledAdapter(options: {
  projectRoot: PackageWorkspaceRef;
  executorName?: string;
  runtime?: ExecutorRuntimeOptions;
  expectedAdapter?: ExecutorProfile["adapter"];
}): ExecutorAdapter {
  return {
    async runBlock({ claim, prompt }) {
      const { name, profile } = await resolveProfileForClaim({
        projectRoot: options.projectRoot,
        claim,
        executorName: options.executorName
      });
      if (options.expectedAdapter && profile.adapter !== options.expectedAdapter) {
        throw new Error(`Executor profile '${name}' is '${profile.adapter}', not '${options.expectedAdapter}'.`);
      }
      return integrationForAdapter(profile.adapter).runBlock({
        projectRoot: options.projectRoot,
        claim,
        prompt,
        executorName: name,
        profile,
        runtime: options.runtime
      });
    },
    async runFeedback({ claim }) {
      const { manifest, workspace } = await loadPackage(options.projectRoot);
      const name = options.executorName ?? manifest.execution.defaultExecutor ?? "default";
      const profile = profilesByName(manifest)[name];
      if (!profile) {
        throw new Error(`Executor profile '${name}' does not exist.`);
      }
      if (options.expectedAdapter && profile.adapter !== options.expectedAdapter) {
        throw new Error(`Executor profile '${name}' is '${profile.adapter}', not '${options.expectedAdapter}'.`);
      }
      return integrationForAdapter(profile.adapter).runFeedback({
        projectRoot: options.projectRoot,
        workspace,
        claim,
        executorName: name,
        profile,
        runtime: options.runtime
      });
    }
  };
}

export function createManualExecutorAdapter(options: { projectRoot: PackageWorkspaceRef; executorName?: string; runtime?: ExecutorRuntimeOptions }): ExecutorAdapter {
  return createProfiledAdapter({ ...options, expectedAdapter: "manual" });
}

export function createCodexExecAdapter(options: { projectRoot: PackageWorkspaceRef; executorName?: string; runtime?: ExecutorRuntimeOptions }): ExecutorAdapter {
  return createProfiledAdapter({ ...options, expectedAdapter: "codex-exec" });
}

export function createOpencodeExecAdapter(options: { projectRoot: PackageWorkspaceRef; executorName?: string; runtime?: ExecutorRuntimeOptions }): ExecutorAdapter {
  return createProfiledAdapter({ ...options, expectedAdapter: "opencode-exec" });
}

export function createClaudeCodeExecAdapter(options: { projectRoot: PackageWorkspaceRef; executorName?: string; runtime?: ExecutorRuntimeOptions }): ExecutorAdapter {
  return createProfiledAdapter({ ...options, expectedAdapter: "claude-code-exec" });
}

export function createPiExecAdapter(options: { projectRoot: PackageWorkspaceRef; executorName?: string; runtime?: ExecutorRuntimeOptions }): ExecutorAdapter {
  return createProfiledAdapter({ ...options, expectedAdapter: "pi-exec" });
}

export function createLocalReviewAdapter(options: { projectRoot: PackageWorkspaceRef; executorName?: string; runtime?: ExecutorRuntimeOptions }): ExecutorAdapter {
  return createProfiledAdapter({ ...options, expectedAdapter: "local-review" });
}

export function createExecutorAdapter(options: { projectRoot: PackageWorkspaceRef; executorName?: string; runtime?: ExecutorRuntimeOptions }): ExecutorAdapter {
  return createProfiledAdapter(options);
}

export function listExecutorProfilesForManifest(manifest: PlanPackageManifest): ExecutorProfileSummary[] {
  const packageProfiles = manifest.executors ?? {};
  const summaries: ExecutorProfileSummary[] = Object.entries(builtinExecutors).map(([name, profile]) => ({
    name,
    source: "builtin",
    ...profile
  }));
  for (const [name, profile] of Object.entries(packageProfiles)) {
    const existing = summaries.findIndex((summary) => summary.name === name);
    const summary: ExecutorProfileSummary = { name, source: "package", ...profile };
    if (existing >= 0) {
      summaries[existing] = summary;
    } else {
      summaries.push(summary);
    }
  }
  return summaries;
}

export async function listExecutorProfiles(options: { projectRoot: PackageWorkspaceRef }): Promise<ExecutorProfileSummary[]> {
  const { manifest } = await loadPackage(options.projectRoot);
  return listExecutorProfilesForManifest(manifest);
}

export async function testExecutorProfile(options: { projectRoot: PackageWorkspaceRef; executorName: string }): Promise<{
  name: string;
  adapter: ExecutorProfile["adapter"];
  ok: boolean;
  message: string;
}> {
  const profiles = await listExecutorProfiles({ projectRoot: options.projectRoot });
  const profile = profiles.find((item) => item.name === options.executorName);
  if (!profile) {
    return { name: options.executorName, adapter: "manual", ok: false, message: `Executor profile '${options.executorName}' does not exist.` };
  }
  if (profile.adapter === "manual") {
    return { name: profile.name, adapter: profile.adapter, ok: true, message: "manual executor is always available" };
  }
  const result = await execWithStdin({
    command: profile.command,
    args: ["--version"],
    cwd: (await resolvePackageWorkspace(options.projectRoot)).rootPath,
    stdin: ""
  });
  return {
    name: profile.name,
    adapter: profile.adapter,
    ok: result.exitCode === 0,
    message: result.exitCode === 0 ? result.stdout.trim() : result.stderr.trim() || `exited with code ${result.exitCode}`
  };
}
