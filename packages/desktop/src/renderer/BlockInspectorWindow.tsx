import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DesktopBlockDetail,
  DesktopBlockRunRecordSummary,
  DesktopFeedbackRecord,
  DesktopGraphViewModel,
  DesktopReviewAttemptSummary,
  DesktopRunRecord
} from "@planweave-ai/runtime";
import { bridge } from "./bridge";
import { createTranslator, type Language } from "./i18n";
import { useDetectedAgents } from "./hooks/useDetectedAgents";
import { BlockInspector } from "./inspector/BlockInspector";

function supportedLanguage(value: string | null): Language {
  return value === "en" || value === "zh-CN" ? value : "zh-CN";
}

export function BlockInspectorWindow() {
  const search = window.location.search;
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const projectRoot = params.get("projectRoot") ?? "";
  const initialBlockRef = params.get("blockRef") ?? "";
  const canvasId = params.get("canvasId");
  const language = supportedLanguage(params.get("language"));
  const t = useMemo(() => createTranslator(language), [language]);
  const { executorOptions } = useDetectedAgents();
  const [blockRef, setBlockRef] = useState(initialBlockRef);
  const [selectedBlock, setSelectedBlock] = useState<DesktopBlockDetail | null>(null);
  const [selectedRunRecord, setSelectedRunRecord] = useState<DesktopRunRecord | null>(null);
  const [graph, setGraph] = useState<DesktopGraphViewModel | null>(null);
  const [blockRunRecords, setBlockRunRecords] = useState<DesktopBlockRunRecordSummary[]>([]);
  const [blockReviewAttempts, setBlockReviewAttempts] = useState<DesktopReviewAttemptSummary[]>([]);
  const [blockFeedbackRecords, setBlockFeedbackRecords] = useState<DesktopFeedbackRecord[]>([]);
  const [error, setError] = useState<string | null>(bridge ? null : t("bridgeUnavailable"));
  const [draftDirty, setDraftDirty] = useState(false);

  const loadBlock = useCallback(
    async (ref: string) => {
      if (!bridge || !projectRoot || !ref) {
        return;
      }
      const canvas = { projectRoot, canvasId };
      try {
        const [nextGraph, block, runRecords, reviewAttempts, feedbackRecords] = await Promise.all([
          bridge.getGraphViewModel(canvas),
          bridge.getBlockDetail(canvas, ref),
          bridge.listBlockRunRecords(canvas, ref),
          bridge.getReviewAttempts(canvas, ref),
          bridge.getFeedbackRecords(canvas, ref)
        ]);
        setGraph(nextGraph);
        setSelectedBlock(block);
        setBlockRunRecords(runRecords);
        setBlockReviewAttempts(reviewAttempts);
        setBlockFeedbackRecords(feedbackRecords);
        setSelectedRunRecord(null);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    },
    [canvasId, projectRoot]
  );

  useEffect(() => {
    void loadBlock(blockRef);
  }, [blockRef, loadBlock]);

  const refreshBlock = useCallback(async () => {
    await loadBlock(blockRef);
  }, [blockRef, loadBlock]);

  useEffect(() => {
    if (draftDirty || selectedRunRecord) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      void loadBlock(blockRef);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [blockRef, draftDirty, loadBlock, selectedRunRecord]);

  const handleBlockSelect = useCallback(
    async (ref: string) => {
      setBlockRef(ref);
      await loadBlock(ref);
    },
    [loadBlock]
  );

  const handleOpenRunRecord = useCallback(
    async (recordId: string | null | undefined) => {
      if (!bridge || !projectRoot || !recordId) {
        return;
      }
      try {
        setSelectedRunRecord(await bridge.getRunRecord({ projectRoot, canvasId }, recordId));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    },
    [canvasId, projectRoot]
  );

  useEffect(() => {
    if (!bridge || !projectRoot || !selectedRunRecord || selectedRunRecord.finishedAt) {
      return undefined;
    }
    const runtimeBridge = bridge;
    const recordId = selectedRunRecord.recordId;
    const timer = window.setInterval(() => {
      void runtimeBridge
        .getRunRecord({ projectRoot, canvasId }, recordId)
        .then(setSelectedRunRecord)
        .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [canvasId, projectRoot, selectedRunRecord]);

  const saveSelectedBlockTitle = useCallback(async () => {
    if (!bridge || !projectRoot || !selectedBlock) {
      return;
    }
    const result = await bridge.updateBlockTitle({ projectRoot, canvasId }, selectedBlock.ref, selectedBlock.title);
    if (!result.ok) {
      setError(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
      return;
    }
    await refreshBlock();
  }, [canvasId, projectRoot, refreshBlock, selectedBlock]);

  const saveSelectedBlockExecutor = useCallback(
    async (executorName: string | null) => {
      if (!bridge || !projectRoot || !selectedBlock) {
        return;
      }
      const result = await bridge.updateBlockExecutor({ projectRoot, canvasId }, selectedBlock.ref, executorName);
      if (!result.ok) {
        setError(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
        return;
      }
      await refreshBlock();
    },
    [canvasId, projectRoot, refreshBlock, selectedBlock]
  );

  const saveSelectedBlockPrompt = useCallback(async () => {
    if (!bridge || !projectRoot || !selectedBlock) {
      return;
    }
    const result = await bridge.updateBlockPrompt({ projectRoot, canvasId }, selectedBlock.ref, selectedBlock.promptMarkdown);
    if (!result.ok) {
      setError(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
      return;
    }
    await refreshBlock();
  }, [canvasId, projectRoot, refreshBlock, selectedBlock]);

  return (
    <BlockInspector
      blockFeedbackRecords={blockFeedbackRecords}
      blockReviewAttempts={blockReviewAttempts}
      blockRunRecords={blockRunRecords}
      className="inset-0 h-screen w-screen min-w-0 rounded-none border-0 shadow-none ring-0"
      error={error}
      executorOptions={executorOptions}
      graph={graph}
      handleOpenRunRecord={handleOpenRunRecord}
      onBlockSelect={handleBlockSelect}
      onClose={() => window.close()}
      onDraftDirtyChange={setDraftDirty}
      saveSelectedBlockExecutor={saveSelectedBlockExecutor}
      saveSelectedBlockPrompt={saveSelectedBlockPrompt}
      saveSelectedBlockTitle={saveSelectedBlockTitle}
      selectedBlock={selectedBlock}
      selectedRunRecord={selectedRunRecord}
      setSelectedBlock={setSelectedBlock}
      setSelectedRunRecord={setSelectedRunRecord}
      t={t}
    />
  );
}
