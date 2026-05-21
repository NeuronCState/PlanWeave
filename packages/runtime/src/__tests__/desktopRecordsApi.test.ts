import { afterEach, describe, expect, it } from "vitest";
import { getFeedbackRecords, getReviewAttempts, getRunRecord, listBlockRunRecords, searchProject } from "../desktop/index.js";
import { claimNext, submitBlockResult, submitReviewResult } from "../taskManager/index.js";
import { createTestWorkspace, writeReport, writeReviewResult } from "./promptTestHelpers.js";

afterEach(() => {
  delete process.env.PLANWEAVE_HOME;
});

describe("desktop records API", () => {
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
