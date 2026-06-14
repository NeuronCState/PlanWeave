import { writeState } from "../state.js";
import type { BlockType, ClaimResult, ClaimScope, ExecutionGraphSession, PackageWorkspaceRef } from "../types.js";
import { claimDispatchedBlock } from "./claimBlockDispatch.js";
import { buildClaimReadiness, type ClaimCandidate } from "./claimReadiness.js";
import { projectBlockerReason } from "./claimReadinessRules.js";
import { patchFeedbackArtifact } from "./feedbackArtifacts.js";
import { createProjectGraphClaimGuard } from "./projectGraphClaimGuard.js";
import { updateTaskIndex } from "./resultIndex.js";
import { loadRuntime, refreshDerivedState } from "./runtimeContext.js";
import {
  activeOpenFeedback,
  blockInScope,
  claimResultForBlock,
  feedbackInScope,
  markClaimed,
  normalizeClaimScope,
  validateClaimScope
} from "./selectors.js";

function withCurrentRef(currentRefs: string[], ref: string): string[] {
  return currentRefs.includes(ref) ? currentRefs : [...currentRefs, ref];
}

function withoutCurrentRef(currentRefs: string[], ref: string): string[] {
  return currentRefs.filter((currentRef) => currentRef !== ref);
}

export async function claimNext(options: {
  projectRoot: PackageWorkspaceRef;
  parallel?: boolean;
  blockType?: BlockType;
  dryRun?: boolean;
  scope?: ClaimScope;
  session?: ExecutionGraphSession;
}): Promise<ClaimResult> {
  const context = await loadRuntime(options);
  let { state } = context;
  const { graph, manifest, workspace } = context;
  const scope = normalizeClaimScope(options.scope);
  const blockType = options.blockType;
  const dryRun = options.dryRun === true;
  const invalidScope = validateClaimScope(scope, graph);
  if (invalidScope) {
    return invalidScope;
  }
  const projectGuard = await createProjectGraphClaimGuard(context);
  const readiness = buildClaimReadiness({ graph, manifest, state, scope, blockType, projectGuard });
  const openFeedback = activeOpenFeedback(state);
  if (openFeedback.length > 1) {
    return { kind: "blocked", reason: "Multiple open feedback envelopes exist; resolve or dismiss one before continuing." };
  }
  if (openFeedback.length === 1) {
    const [feedbackId, feedback] = openFeedback[0];
    if (!feedbackInScope(feedback, graph, scope)) {
      return { kind: "none", reason: "no_claimable_blocks_in_scope" };
    }
    const taskId = graph.blockTaskByRef.get(feedback.sourceReviewBlockRef);
    if (!taskId) {
      throw new Error(`Feedback '${feedbackId}' points to an unknown review block.`);
    }
    const projectBlocker = projectBlockerReason(projectGuard, taskId);
    if (projectBlocker) {
      return { kind: "blocked", ref: feedback.sourceReviewBlockRef, reason: projectBlocker };
    }
    if (dryRun) {
      return { kind: "feedback", content: feedback.content };
    }
    await patchFeedbackArtifact(workspace, taskId, feedbackId, { status: "in_progress" });
    await updateTaskIndex(workspace, taskId, (index) => ({
      ...index,
      feedbackStatusById: {
        ...(index.feedbackStatusById ?? {}),
        [feedbackId]: "in_progress"
      }
    }));
    feedback.status = "in_progress";
    state.currentFeedbackId = feedbackId;
    state.currentReviewBlockRef = feedback.sourceReviewBlockRef;
    state.currentRefs = withoutCurrentRef(state.currentRefs, feedback.sourceReviewBlockRef);
    state = refreshDerivedState(manifest, state);
    await writeState(workspace.stateFile, state);
    return { kind: "feedback", content: feedback.content };
  }

  const inProgressReview = graph.blockRefsInManifestOrder.find((ref) => {
    const block = graph.blocksByRef.get(ref);
    return block?.type === "review" && state.blocks[ref]?.status === "in_progress";
  });
  if (inProgressReview && state.currentFeedbackId) {
    if (blockType && blockType !== "review") {
      return { kind: "blocked", ref: inProgressReview, reason: "A review block is in progress outside the selected claim type." };
    }
    const currentFeedback = state.feedback[state.currentFeedbackId];
    if (currentFeedback?.status === "resolved") {
      if (!blockInScope(inProgressReview, graph, scope)) {
        return { kind: "blocked", ref: inProgressReview, reason: "A review block is in progress outside the selected Auto Run scope." };
      }
      if (dryRun) {
        return claimResultForBlock(inProgressReview, graph, "feedback_resolved");
      }
      state.blocks[inProgressReview] = { ...state.blocks[inProgressReview], pendingFeedbackId: null };
      state.currentRefs = withCurrentRef(state.currentRefs, inProgressReview);
      state.currentFeedbackId = null;
      state.currentReviewBlockRef = inProgressReview;
      await writeState(workspace.stateFile, refreshDerivedState(manifest, state));
      return claimResultForBlock(inProgressReview, graph, "feedback_resolved");
    }
  }
  if (inProgressReview) {
    if (blockType && blockType !== "review") {
      return { kind: "blocked", ref: inProgressReview, reason: "A review block is in progress outside the selected claim type." };
    }
    if (!blockInScope(inProgressReview, graph, scope)) {
      return { kind: "blocked", ref: inProgressReview, reason: "A review block is in progress outside the selected Auto Run scope." };
    }
    const reason = state.blocks[inProgressReview]?.pendingFeedbackId ? "feedback_resolved" : "current";
    if (dryRun) {
      return claimResultForBlock(inProgressReview, graph, reason);
    }
    state.blocks[inProgressReview] = { ...state.blocks[inProgressReview], pendingFeedbackId: null };
    state.currentRefs = withCurrentRef(state.currentRefs, inProgressReview);
    state.currentReviewBlockRef = inProgressReview;
    await writeState(workspace.stateFile, refreshDerivedState(manifest, state));
    return claimResultForBlock(inProgressReview, graph, reason);
  }

  const current = graph.blockRefsInManifestOrder.find((ref) => {
    const block = graph.blocksByRef.get(ref);
    return state.blocks[ref]?.status === "in_progress" && block?.type !== "review";
  });
  if (current) {
    const currentBlock = graph.blocksByRef.get(current);
    if (blockType && currentBlock?.type !== blockType) {
      return { kind: "blocked", ref: current, reason: "A block is in progress outside the selected claim type." };
    }
    if (!blockInScope(current, graph, scope)) {
      return { kind: "blocked", ref: current, reason: "A block is in progress outside the selected Auto Run scope." };
    }
    return claimResultForBlock(current, graph, "current");
  }

  const claimCandidate = async (candidate: ClaimCandidate): Promise<ClaimResult> => {
    if (dryRun) {
      return candidate.result;
    }
    markClaimed(state, candidate.ref, graph);
    state = refreshDerivedState(manifest, state);
    await writeState(workspace.stateFile, state);
    return candidate.result;
  };

  const claimSequentialReviewBlock = async (): Promise<ClaimResult | null> => {
    const candidate = readiness.sequentialReviewCandidates[0];
    return candidate ? claimCandidate(candidate) : null;
  };

  if (options.parallel) {
    if (!manifest.execution.parallel.enabled) {
      return { kind: "blocked", reason: "Parallel execution is disabled by the Plan Package." };
    }
    const selected = readiness.parallelBatchRefs;
    if (selected.length === 0) {
      const reviewClaim = await claimSequentialReviewBlock();
      if (reviewClaim) {
        if (dryRun && reviewClaim.kind === "block" && reviewClaim.blockType === "review") {
          return {
            ...reviewClaim,
            requestedMode: "parallel",
            parallelFallbackReason: "review_requires_sequential_claim",
            nextParallelClaimable: []
          };
        }
        return reviewClaim;
      }
      if (readiness.firstProjectBlockedResult) {
        return readiness.firstProjectBlockedResult;
      }
      state.currentRefs = [];
      if (!dryRun) {
        await writeState(workspace.stateFile, refreshDerivedState(manifest, state));
      }
      return { kind: "none", reason: "no_parallel_blocks", nextSequentialClaimable: readiness.scopedNextSequentialClaimable };
    }
    if (dryRun) {
      return { kind: "batch", refs: selected };
    }
    for (const ref of selected) {
      state.blocks[ref] = { ...state.blocks[ref], status: "in_progress" };
    }
    state.currentRefs = selected;
    await writeState(workspace.stateFile, refreshDerivedState(manifest, state));
    return { kind: "batch", refs: selected };
  }

  const implementationClaim = readiness.sequentialImplementationCandidates[0];
  if (implementationClaim) {
    return claimCandidate(implementationClaim);
  }

  const reviewClaim = await claimSequentialReviewBlock();
  if (reviewClaim) {
    return reviewClaim;
  }

  if (readiness.firstProjectBlockedResult) {
    return readiness.firstProjectBlockedResult;
  }

  if (readiness.firstBlockedResult) {
    return readiness.firstBlockedResult;
  }

  if (!dryRun) {
    await writeState(workspace.stateFile, refreshDerivedState(manifest, state));
  }
  return { kind: "none", reason: "no_claimable_blocks" };
}

export async function claimBlock(options: {
  projectRoot: PackageWorkspaceRef;
  ref: string;
  dispatch?: boolean;
  session?: ExecutionGraphSession;
}): Promise<ClaimResult> {
  if (options.dispatch) {
    return claimDispatchedBlock(options);
  }
  return claimNext({ projectRoot: options.projectRoot, scope: { kind: "block", blockRef: options.ref }, session: options.session });
}

export async function claimTask(options: {
  projectRoot: PackageWorkspaceRef;
  taskId: string;
  session?: ExecutionGraphSession;
}): Promise<ClaimResult> {
  return claimNext({ projectRoot: options.projectRoot, scope: { kind: "task", taskId: options.taskId }, session: options.session });
}

export async function claimBlockType(options: {
  projectRoot: PackageWorkspaceRef;
  blockType: BlockType;
  session?: ExecutionGraphSession;
}): Promise<ClaimResult> {
  return claimNext({ projectRoot: options.projectRoot, blockType: options.blockType, session: options.session });
}
