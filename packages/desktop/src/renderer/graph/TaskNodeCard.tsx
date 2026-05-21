import { Handle, Position, type NodeProps } from "@xyflow/react";
import { MessageSquareWarningIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TaskFlowNode } from "../types";
import { statusIcon, statusVariant } from "../viewHelpers";
import { BlockPreviewButton } from "./BlockPreviewButton";

export function TaskNodeCard({ data }: NodeProps<TaskFlowNode>) {
  const {
    task,
    titleDraft,
    promptDraft,
    saveState,
    executorOptions,
    labels,
    selectedBlock,
    blockRunRecords,
    blockReviewAttempts,
    blockFeedbackRecords,
    onTitleChange,
    onTitleSave,
    onExecutorChange,
    onPromptChange,
    onPromptSave,
    onBlockSelect,
    onSelectedBlockChange,
    onBlockTitleSave,
    onBlockExecutorChange,
    onBlockPromptSave,
    onOpenRunRecord
  } = data;
  const hasException = task.exceptions.length > 0;

  return (
    <Card className="h-[260px] w-[340px] border bg-card shadow-sm" size="sm">
      <Handle type="target" position={Position.Left} />
      <CardHeader className="min-h-14">
        <CardTitle className="flex min-w-0 items-center gap-2">
          <Input
            aria-label={`${task.taskId} title`}
            className="h-8 min-w-0 border-transparent px-1 font-semibold shadow-none"
            value={titleDraft}
            onChange={(event) => onTitleChange(task.taskId, event.target.value)}
            onBlur={() => onTitleSave(task.taskId)}
          />
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <Badge variant={hasException ? "destructive" : statusVariant[task.status]}>
            {statusIcon(hasException ? "blocked" : task.status)}
            {hasException ? labels.exception : task.status}
          </Badge>
          <Select value={task.executor ?? "__inherit"} onValueChange={(value) => onExecutorChange(task.taskId, value === "__inherit" ? null : value)}>
            <SelectTrigger className="h-7 w-32">
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
          <Badge variant="outline">{task.executorLabel}</Badge>
        </CardDescription>
        <CardAction>
          {hasException ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon-sm" variant="destructive" aria-label={labels.taskException}>
                  <MessageSquareWarningIcon data-icon="inline-start" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <PopoverHeader>
                  <PopoverTitle>{labels.exceptionOverlay}</PopoverTitle>
                  <PopoverDescription>{task.taskId}</PopoverDescription>
                </PopoverHeader>
                <div className="flex flex-col gap-2">
                  {task.exceptions.map((exception) => (
                    <div className="rounded-md border bg-muted/40 p-2" key={`${exception.ref}-${exception.source}`}>
                      <div className="text-sm font-medium">{exception.ref}</div>
                      <div className="text-xs text-muted-foreground">{exception.reason}</div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="text-xs font-medium text-muted-foreground">{labels.taskPrompt}</div>
          <Textarea
            aria-label={`${task.taskId} prompt`}
            className="h-20 resize-none"
            value={promptDraft}
            onChange={(event) => onPromptChange(task.taskId, event.target.value)}
            onBlur={() => onPromptSave(task.taskId)}
          />
          <div className="text-xs text-muted-foreground">{saveState}</div>
        </div>
        <div className="flex min-h-0 flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
            <span>{labels.blockStack}</span>
            {task.overflowBlockCount > 0 ? <span>+{task.overflowBlockCount} {labels.more}</span> : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
            {task.blockPreview.map((block) => (
              <BlockPreviewButton
                block={block}
                blockFeedbackRecords={blockFeedbackRecords}
                blockReviewAttempts={blockReviewAttempts}
                blockRunRecords={blockRunRecords}
                executorOptions={executorOptions}
                key={block.ref}
                labels={labels}
                onBlockExecutorChange={onBlockExecutorChange}
                onBlockPromptSave={onBlockPromptSave}
                onBlockTitleSave={onBlockTitleSave}
                onOpenRunRecord={onOpenRunRecord}
                onSelect={onBlockSelect}
                onSelectedBlockChange={onSelectedBlockChange}
                selectedBlock={selectedBlock}
              />
            ))}
          </div>
        </div>
      </CardContent>
      <Handle type="source" position={Position.Right} />
    </Card>
  );
}
