import { useState } from "react";
import type { DesktopBlockDetail, DesktopBlockPreview, DesktopBlockRunRecordSummary, DesktopFeedbackRecord, DesktopReviewAttemptSummary } from "@planweave/runtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { TaskNodeData } from "../types";
import { statusVariant } from "../viewHelpers";

export function BlockPreviewButton({
  block,
  blockFeedbackRecords,
  blockReviewAttempts,
  blockRunRecords,
  executorOptions,
  labels,
  onBlockExecutorChange,
  onBlockPromptSave,
  onBlockTitleSave,
  onOpenRunRecord,
  onSelect,
  onSelectedBlockChange,
  selectedBlock
}: {
  block: DesktopBlockPreview;
  blockFeedbackRecords: DesktopFeedbackRecord[];
  blockReviewAttempts: DesktopReviewAttemptSummary[];
  blockRunRecords: DesktopBlockRunRecordSummary[];
  executorOptions: string[];
  labels: TaskNodeData["labels"];
  onBlockExecutorChange: (executorName: string | null) => void;
  onBlockPromptSave: () => void;
  onBlockTitleSave: () => void;
  onOpenRunRecord: (recordId: string | null | undefined) => void;
  onSelect: (ref: string) => void;
  onSelectedBlockChange: (block: DesktopBlockDetail) => void;
  selectedBlock: DesktopBlockDetail | null;
}) {
  const [open, setOpen] = useState(false);
  const isSelected = selectedBlock?.ref === block.ref;
  const latestRun = isSelected ? blockRunRecords[0] : null;
  const latestReviewAttempt = isSelected ? blockReviewAttempts[0] : null;
  const latestFeedbackRecord = isSelected ? blockFeedbackRecords[0] : null;

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          onSelect(block.ref);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          className="flex h-7 items-center justify-between gap-2 rounded-md border bg-background px-2 text-left text-xs hover:bg-muted"
          type="button"
          onClick={() => onSelect(block.ref)}
        >
          <span className="min-w-0 truncate">{block.title}</span>
          <Badge variant={statusVariant[block.status]}>{block.type}</Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[420px]">
        <PopoverHeader>
          <PopoverTitle>{labels.selectedBlock}</PopoverTitle>
          <PopoverDescription>{block.ref}</PopoverDescription>
        </PopoverHeader>
        {isSelected && selectedBlock ? (
          <FieldGroup>
            <Field>
              <FieldLabel>{labels.title}</FieldLabel>
              <Input
                value={selectedBlock.title}
                onBlur={onBlockTitleSave}
                onChange={(event) => onSelectedBlockChange({ ...selectedBlock, title: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>{labels.agent}</FieldLabel>
              <Select value={selectedBlock.executor ?? "__inherit"} onValueChange={(value) => onBlockExecutorChange(value === "__inherit" ? null : value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="__inherit">{labels.inherit}</SelectItem>
                    {executorOptions.map((executor) => (
                      <SelectItem value={executor} key={executor}>
                        {executor}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                {labels.effectiveExecutor}: {selectedBlock.effectiveExecutor ?? labels.manualExecutor}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>{labels.sourcePrompt}</FieldLabel>
              <Textarea
                className="min-h-40 resize-none"
                value={selectedBlock.promptMarkdown}
                onChange={(event) => onSelectedBlockChange({ ...selectedBlock, promptMarkdown: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>{labels.blockExecutionSummary}</FieldLabel>
              <div className="flex flex-col gap-2 text-xs">
                {latestRun ? (
                  <button
                    className="flex items-center justify-between gap-2 rounded-md border p-2 text-left hover:bg-muted/50"
                    type="button"
                    onClick={() => onOpenRunRecord(latestRun.recordId)}
                  >
                    <span className="min-w-0 truncate">
                      {labels.latestRun}: {latestRun.finishedAt ?? latestRun.startedAt ?? latestRun.runId}
                    </span>
                    <Badge variant={latestRun.exitCode === 0 || latestRun.exitCode === null ? "secondary" : "destructive"}>
                      {latestRun.exitCode ?? "-"}
                    </Badge>
                  </button>
                ) : (
                  <div className="text-muted-foreground">{labels.noBlockRecords}</div>
                )}
                {latestReviewAttempt ? (
                  <div className="rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{labels.latestReviewAttempt}</span>
                      <Badge variant={latestReviewAttempt.verdict === "passed" ? "secondary" : "outline"}>{latestReviewAttempt.verdict ?? "-"}</Badge>
                    </div>
                    <div className="line-clamp-2 text-muted-foreground">{latestReviewAttempt.contentPreview}</div>
                  </div>
                ) : null}
                {latestFeedbackRecord ? (
                  <div className="rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{labels.feedbackMarker}</span>
                      <Badge variant={latestFeedbackRecord.status === "resolved" ? "secondary" : "destructive"}>{latestFeedbackRecord.status}</Badge>
                    </div>
                    <div className="line-clamp-2 text-muted-foreground">{latestFeedbackRecord.content}</div>
                  </div>
                ) : null}
                {selectedBlock.exceptionReason ? <div className="rounded-md border border-destructive p-2 text-destructive">{selectedBlock.exceptionReason}</div> : null}
              </div>
            </Field>
            <Button size="sm" onClick={onBlockPromptSave}>
              {labels.savePrompt}
            </Button>
          </FieldGroup>
        ) : (
          <Skeleton className="h-40 w-full" />
        )}
      </PopoverContent>
    </Popover>
  );
}
