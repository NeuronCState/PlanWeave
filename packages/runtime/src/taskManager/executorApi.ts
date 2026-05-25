import { join } from "node:path";
import { parseBlockRef } from "../graph/compileTaskGraph.js";
import type { BlockExplanation, CurrentWork, CurrentWorkItem, ManifestBlock, PackageWorkspaceRef } from "../types.js";
import { getExecutionStatus } from "./executionStatus.js";
import { loadRuntime } from "./runtimeContext.js";
import { getBlock } from "./selectors.js";

function submitCommand(ref: string, block: ManifestBlock): string {
  if (block.type === "review") {
    return `planweave submit-review ${ref} --result <review-result.json>`;
  }
  return `planweave submit-result ${ref} --report <report.md>`;
}

function currentItem(ref: string, block: ManifestBlock, packageDir: string): CurrentWorkItem {
  const { taskId, blockId } = parseBlockRef(ref);
  return {
    ref,
    taskId,
    blockId,
    blockType: block.type,
    promptPath: join(packageDir, block.prompt),
    submitCommand: submitCommand(ref, block)
  };
}

export async function explainBlock(options: { projectRoot: PackageWorkspaceRef; ref: string }): Promise<BlockExplanation> {
  const context = await loadRuntime(options);
  const block = getBlock(context.graph, options.ref);
  const status = await getExecutionStatus(options);
  const hint = status.claimHints.find((candidate) => candidate.ref === options.ref);
  if (!hint) {
    throw new Error(`Block '${options.ref}' does not exist.`);
  }
  return {
    ...hint,
    promptPath: join(context.workspace.packageDir, block.prompt),
    submitCommand: submitCommand(options.ref, block)
  };
}

export async function getCurrentWork(options: { projectRoot: PackageWorkspaceRef }): Promise<CurrentWork> {
  const context = await loadRuntime(options);
  const items = context.state.currentRefs.map((ref) => currentItem(ref, getBlock(context.graph, ref), context.workspace.packageDir));
  const blockingReason =
    items.length > 0 || context.state.currentFeedbackId
      ? null
      : "No current claim. Run `planweave claim-next`, `planweave claim <ref>`, or `planweave status`.";
  return {
    currentRefs: context.state.currentRefs,
    currentFeedbackId: context.state.currentFeedbackId,
    currentReviewBlockRef: context.state.currentReviewBlockRef,
    items,
    blockingReason
  };
}
