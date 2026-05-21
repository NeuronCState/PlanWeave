import { describe, expect, it } from "vitest";
import { claimNext, markBlockBlocked, markBlockDiverged, resolveBlockDivergence, unblockBlock } from "../taskManager/index.js";
import { createTestWorkspace } from "./promptTestHelpers.js";

describe("block recovery commands", () => {
  it("blocks and unblocks block refs with explicit reasons", async () => {
    const { root } = await createTestWorkspace();
    await claimNext({ projectRoot: root });

    expect(await markBlockBlocked({ projectRoot: root, ref: "T-001#B-001", reason: "waiting for input" })).toEqual({
      ref: "T-001#B-001",
      status: "blocked",
      reason: "waiting for input"
    });
    expect(await unblockBlock({ projectRoot: root, ref: "T-001#B-001", reason: "input arrived" })).toMatchObject({
      ref: "T-001#B-001",
      status: "ready",
      reason: "input arrived"
    });
  });

  it("requires an unblock reason", async () => {
    const { root } = await createTestWorkspace();
    await markBlockBlocked({ projectRoot: root, ref: "T-001#B-001", reason: "waiting" });

    await expect(unblockBlock({ projectRoot: root, ref: "T-001#B-001", reason: " " })).rejects.toThrow(
      "unblock requires a non-empty reason"
    );
  });

  it("records and resolves divergence on block refs", async () => {
    const { root } = await createTestWorkspace();

    expect(await markBlockDiverged({ projectRoot: root, ref: "T-001#B-001", reason: "manifest changed" })).toEqual({
      ref: "T-001#B-001",
      status: "diverged",
      reason: "manifest changed"
    });
    expect(await resolveBlockDivergence({ projectRoot: root, ref: "T-001#B-001", reason: "rebased" })).toMatchObject({
      ref: "T-001#B-001",
      status: "ready",
      reason: "rebased"
    });
  });
});
