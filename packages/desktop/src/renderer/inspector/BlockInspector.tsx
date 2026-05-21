import type { Dispatch, SetStateAction } from "react";
import type { DesktopBlockDetail, DesktopBlockRunRecordSummary, DesktopFeedbackRecord, DesktopGraphViewModel, DesktopReviewAttemptSummary, DesktopRunRecord } from "@planweave/runtime";
import { SquareIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { createTranslator } from "../i18n";
import { statusVariant } from "../viewHelpers";

type BlockInspectorProps = {
  blockFeedbackRecords: DesktopFeedbackRecord[];
  blockReviewAttempts: DesktopReviewAttemptSummary[];
  blockRunRecords: DesktopBlockRunRecordSummary[];
  error: string | null;
  graph: DesktopGraphViewModel | null;
  handleOpenRunRecord: (recordId: string | null | undefined) => Promise<void>;
  saveSelectedBlockExecutor: (executorName: string | null) => Promise<void>;
  saveSelectedBlockPrompt: () => Promise<void>;
  saveSelectedBlockTitle: () => Promise<void>;
  selectedBlock: DesktopBlockDetail | null;
  selectedRunRecord: DesktopRunRecord | null;
  setSelectedBlock: Dispatch<SetStateAction<DesktopBlockDetail | null>>;
  setSelectedRunRecord: Dispatch<SetStateAction<DesktopRunRecord | null>>;
  t: ReturnType<typeof createTranslator>;
};

export function BlockInspector({
  blockFeedbackRecords,
  blockReviewAttempts,
  blockRunRecords,
  error,
  graph,
  handleOpenRunRecord,
  saveSelectedBlockExecutor,
  saveSelectedBlockPrompt,
  saveSelectedBlockTitle,
  selectedBlock,
  selectedRunRecord,
  setSelectedBlock,
  setSelectedRunRecord,
  t
}: BlockInspectorProps) {
  const latestBlockRun = blockRunRecords[0];
  const latestReviewAttempt = blockReviewAttempts[0];
  const latestFeedbackRecord = blockFeedbackRecords[0];

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l bg-background">
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className="text-sm font-semibold">{t("selectedBlock")}</div>
        {selectedRunRecord ? (
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">{t("runRecordDetail")}</CardTitle>
              <CardDescription>{selectedRunRecord.recordId}</CardDescription>
              <CardAction>
                <Button size="icon-sm" variant="ghost" aria-label={t("closeRecord")} onClick={() => setSelectedRunRecord(null)}>
                  <SquareIcon data-icon="inline-start" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex max-h-80 flex-col gap-2 overflow-hidden">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Badge variant="outline">{selectedRunRecord.adapter ?? t("manualExecutor")}</Badge>
                <Badge variant={selectedRunRecord.exitCode === 0 || selectedRunRecord.exitCode === null ? "secondary" : "destructive"}>
                  {selectedRunRecord.exitCode ?? "-"}
                </Badge>
              </div>
              {selectedRunRecord.stdoutSummary ? (
                <div className="text-xs text-muted-foreground">
                  {t("latestOutput")}: {selectedRunRecord.stdoutSummary}
                </div>
              ) : null}
              {selectedRunRecord.stderrSummary ? (
                <div className="text-xs text-destructive">
                  {t("stderr")}: {selectedRunRecord.stderrSummary}
                </div>
              ) : null}
              <ScrollArea className="h-40 rounded-md border p-2">
                <pre className="whitespace-pre-wrap text-xs">{selectedRunRecord.reportMarkdown || selectedRunRecord.promptMarkdown}</pre>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : null}
        {selectedBlock ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
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
            <Textarea className="min-h-56 flex-1 resize-none" value={selectedBlock.promptMarkdown} onChange={(event) => setSelectedBlock({ ...selectedBlock, promptMarkdown: event.target.value })} />
            <Button onClick={() => void saveSelectedBlockPrompt()}>{t("savePrompt")}</Button>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">{t("blocks")}</div>
        )}
      </div>
      {error ? (
        <>
          <Separator />
          <div className="p-3">
            <Badge variant="destructive">{error}</Badge>
          </div>
        </>
      ) : null}
    </aside>
  );
}
