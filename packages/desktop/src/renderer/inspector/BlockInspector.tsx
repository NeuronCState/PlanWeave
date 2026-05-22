import { useMemo, useState } from "react";
import type { CSSProperties, Dispatch, PointerEvent, SetStateAction } from "react";
import type { DesktopBlockDetail, DesktopBlockRunRecordSummary, DesktopFeedbackRecord, DesktopGraphViewModel, DesktopReviewAttemptSummary, DesktopRunRecord } from "@planweave/runtime";
import { GripIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { createTranslator } from "../i18n";
import { statusVariant } from "../viewHelpers";
import { BlockConnectionsCard } from "./BlockConnectionsCard";
import { BlockInspectorZoomControls } from "./BlockInspectorZoomControls";
import { BlockRunRecordCard } from "./BlockRunRecordCard";

type BlockInspectorProps = {
  blockFeedbackRecords: DesktopFeedbackRecord[];
  blockReviewAttempts: DesktopReviewAttemptSummary[];
  blockRunRecords: DesktopBlockRunRecordSummary[];
  className?: string;
  dragHandlers?: {
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  };
  resizeHandlers?: {
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  };
  error: string | null;
  graph: DesktopGraphViewModel | null;
  handleOpenRunRecord: (recordId: string | null | undefined) => Promise<void>;
  onClose: () => void;
  saveSelectedBlockExecutor: (executorName: string | null) => Promise<void>;
  saveSelectedBlockPrompt: () => Promise<void>;
  saveSelectedBlockTitle: () => Promise<void>;
  selectedBlock: DesktopBlockDetail | null;
  selectedRunRecord: DesktopRunRecord | null;
  setSelectedBlock: Dispatch<SetStateAction<DesktopBlockDetail | null>>;
  setSelectedRunRecord: Dispatch<SetStateAction<DesktopRunRecord | null>>;
  style?: CSSProperties;
  t: ReturnType<typeof createTranslator>;
};

export function BlockInspector({
  blockFeedbackRecords,
  blockReviewAttempts,
  blockRunRecords,
  className,
  dragHandlers,
  error,
  graph,
  handleOpenRunRecord,
  onClose,
  saveSelectedBlockExecutor,
  saveSelectedBlockPrompt,
  saveSelectedBlockTitle,
  selectedBlock,
  selectedRunRecord,
  resizeHandlers,
  setSelectedBlock,
  setSelectedRunRecord,
  style,
  t
}: BlockInspectorProps) {
  const latestBlockRun = blockRunRecords[0];
  const latestReviewAttempt = blockReviewAttempts[0];
  const latestFeedbackRecord = blockFeedbackRecords[0];
  const [zoom, setZoom] = useState(1);
  const taskBlocks = useMemo(() => {
    if (!graph || !selectedBlock) {
      return [];
    }
    return graph.tasks.find((task) => task.taskId === selectedBlock.taskId)?.blocks ?? [];
  }, [graph, selectedBlock]);

  if (!selectedBlock && !selectedRunRecord && !error) {
    return null;
  }

  return (
    <Card className={cn("absolute flex min-h-[420px] min-w-[380px] flex-col overflow-hidden bg-background shadow-xl", className)} size="sm" style={style}>
      <CardHeader className="cursor-move border-b" {...dragHandlers}>
        <CardTitle>{selectedRunRecord ? t("runRecordDetail") : t("selectedBlock")}</CardTitle>
        <CardAction className="flex items-center gap-1">
          <BlockInspectorZoomControls onClose={onClose} setZoom={setZoom} t={t} zoom={zoom} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
        {selectedRunRecord ? (
          <BlockRunRecordCard selectedRunRecord={selectedRunRecord} setSelectedRunRecord={setSelectedRunRecord} t={t} />
        ) : null}
        {selectedBlock ? (
          <div className="flex min-h-0 flex-1 origin-top-left flex-col gap-3" style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%` }}>
            <div className="flex items-center justify-between gap-2">
              <Input
                aria-label={t("title")}
                className="min-w-0 font-medium"
                value={selectedBlock.title}
                onChange={(event) => setSelectedBlock({ ...selectedBlock, title: event.target.value })}
                onBlur={() => void saveSelectedBlockTitle()}
              />
              <Badge variant={statusVariant[selectedBlock.status]}>{selectedBlock.status}</Badge>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-xs font-medium text-muted-foreground">{t("agent")}</div>
              <Select value={selectedBlock.executor ?? "__inherit"} onValueChange={(value) => void saveSelectedBlockExecutor(value === "__inherit" ? null : value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="__inherit">{t("inheritExecutor")}</SelectItem>
                    {graph?.executorOptions.map((executor) => (
                      <SelectItem value={executor} key={executor}>
                        {executor}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                {t("effectiveExecutor")}: {selectedBlock.effectiveExecutor ?? t("manualExecutor")}
              </div>
            </div>
            <Card size="sm">
              <CardHeader>
                <CardTitle className="text-sm">{t("blockExecutionSummary")}</CardTitle>
                <CardDescription>{selectedBlock.ref}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-xs">
                {latestBlockRun ? (
                  <button className="flex items-center justify-between gap-2 rounded-md border p-2 text-left hover:bg-muted/50" type="button" onClick={() => void handleOpenRunRecord(latestBlockRun.recordId)}>
                    <span className="min-w-0 truncate">
                      {t("latestRun")}: {latestBlockRun.finishedAt ?? latestBlockRun.startedAt ?? latestBlockRun.runId}
                    </span>
                    <Badge variant={latestBlockRun.exitCode === 0 || latestBlockRun.exitCode === null ? "secondary" : "destructive"}>
                      {latestBlockRun.exitCode ?? "-"}
                    </Badge>
                  </button>
                ) : (
                  <div className="text-muted-foreground">{t("noBlockRecords")}</div>
                )}
                {latestReviewAttempt ? (
                  <div className="rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{t("latestReviewAttempt")}</span>
                      <Badge variant={latestReviewAttempt.verdict === "passed" ? "secondary" : "outline"}>{latestReviewAttempt.verdict ?? "-"}</Badge>
                    </div>
                    <div className="line-clamp-2 text-muted-foreground">{latestReviewAttempt.contentPreview}</div>
                  </div>
                ) : null}
                {latestFeedbackRecord ? (
                  <div className="rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{t("feedbackMarker")}</span>
                      <Badge variant={latestFeedbackRecord.status === "resolved" ? "secondary" : "destructive"}>{latestFeedbackRecord.status}</Badge>
                    </div>
                    <div className="line-clamp-2 text-muted-foreground">{latestFeedbackRecord.content}</div>
                  </div>
                ) : null}
                {selectedBlock.exceptionReason ? <div className="rounded-md border border-destructive p-2 text-destructive">{selectedBlock.exceptionReason}</div> : null}
              </CardContent>
            </Card>
            <BlockConnectionsCard blocks={taskBlocks} dependencies={selectedBlock.dependencies} selectedBlockRef={selectedBlock.ref} />
            <Textarea className="h-56 resize-none" value={selectedBlock.promptMarkdown} onChange={(event) => setSelectedBlock({ ...selectedBlock, promptMarkdown: event.target.value })} />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">{t("blocks")}</div>
        )}
      </CardContent>
      {error ? (
        <>
          <Separator />
          <CardContent>
            <Badge variant="destructive">{error}</Badge>
          </CardContent>
        </>
      ) : null}
      {selectedBlock ? (
        <CardFooter>
          <Button className="w-full" onClick={() => void saveSelectedBlockPrompt()}>
            {t("savePrompt")}
          </Button>
        </CardFooter>
      ) : null}
      <div className="absolute bottom-1 right-1 flex h-5 w-5 cursor-nwse-resize items-center justify-center rounded-sm text-muted-foreground hover:bg-muted" aria-label="调整 Block 面板大小" role="separator" {...resizeHandlers}>
        <GripIcon className="h-4 w-4" />
      </div>
    </Card>
  );
}
