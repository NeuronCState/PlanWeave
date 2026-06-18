import type { CSSProperties, Dispatch, PointerEvent, SetStateAction } from "react";
import type { DesktopAutoRunState, DesktopProjectSummary } from "@planweave-ai/runtime";
import { FolderOpenIcon, MoveIcon, PauseIcon, PlayIcon, RefreshCwIcon, SquareIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from "@/components/ui/context-menu";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { createTranslator } from "../i18n";
import type { AutoRunScopeMode } from "../types";
import { formatElapsed } from "../viewHelpers";

type FloatingAutoRunControlProps = {
  autoRunScopeMode: AutoRunScopeMode;
  autoRunState: DesktopAutoRunState | null;
  dirtyPromptCount: number;
  handleAutoRunClick: () => Promise<void>;
  handleRevealPathInFinder: (path: string | null | undefined) => Promise<void>;
  miniRunPanelOpen: boolean;
  moveAutoRunControl: (event: PointerEvent<HTMLButtonElement>) => void;
  refreshPackageFiles: () => Promise<void>;
  selectedBlockPresent: boolean;
  selectedProject: DesktopProjectSummary | null;
  selectedTaskPanelId: string | null;
  setAutoRunScopeMode: Dispatch<SetStateAction<AutoRunScopeMode>>;
  setMiniRunPanelOpen: Dispatch<SetStateAction<boolean>>;
  startAutoRunControlDrag: (event: PointerEvent<HTMLButtonElement>) => void;
  stopAutoRunClick: () => Promise<void>;
  stopAutoRunControlDrag: (event: PointerEvent<HTMLButtonElement>) => void;
  style: CSSProperties;
  t: ReturnType<typeof createTranslator>;
};

function isFailureState(state: DesktopAutoRunState | null): state is DesktopAutoRunState {
  return state?.phase === "blocked" || state?.phase === "failed";
}

function FailureDetailRow({ label, testId, value }: { label: string; testId?: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words" data-testid={testId}>{value}</span>
    </div>
  );
}

function AutoRunFailureDetails({ state, t }: { state: DesktopAutoRunState; t: ReturnType<typeof createTranslator> }) {
  const explanation = state.explanation;
  return (
    <div className="rounded-md border border-destructive/50 bg-destructive/5 p-2 text-xs" data-testid="auto-run-failure-details">
      <div className="mb-2 font-medium text-destructive">{t("failureDetails")}</div>
      <div className="flex flex-col gap-1.5">
        <FailureDetailRow label={t("phase")} value={state.phase} />
        <FailureDetailRow label={t("error")} testId="auto-run-error" value={explanation.error ?? state.error} />
        <FailureDetailRow label={t("nextAction")} value={explanation.nextAction.message} />
        <FailureDetailRow label={t("actionKind")} value={explanation.nextAction.kind} />
        <FailureDetailRow label={t("suggestedCommand")} testId="auto-run-command" value={explanation.nextAction.command} />
        <FailureDetailRow label={t("latestRecordPath")} testId="auto-run-latest-record-path" value={explanation.latestRecordPath} />
        <FailureDetailRow label={t("currentBlock")} value={explanation.currentRef} />
        <FailureDetailRow label={t("agent")} value={explanation.currentExecutor} />
        <FailureDetailRow label={t("latestOutput")} value={explanation.latestOutputSummary} />
      </div>
    </div>
  );
}

export function FloatingAutoRunControl({
  autoRunScopeMode,
  autoRunState,
  dirtyPromptCount,
  handleAutoRunClick,
  handleRevealPathInFinder,
  miniRunPanelOpen,
  moveAutoRunControl,
  refreshPackageFiles,
  selectedBlockPresent,
  selectedProject,
  selectedTaskPanelId,
  setAutoRunScopeMode,
  setMiniRunPanelOpen,
  startAutoRunControlDrag,
  stopAutoRunClick,
  stopAutoRunControlDrag,
  style,
  t
}: FloatingAutoRunControlProps) {
  const canStop = autoRunState ? ["running", "pausing", "paused", "manual"].includes(autoRunState.phase) : false;
  const hasProject = Boolean(selectedProject);
  const explanation = autoRunState?.explanation ?? null;
  const showFailureDetails = isFailureState(autoRunState);

  return (
    <div className="absolute flex items-center gap-2 rounded-xl border bg-background p-2 shadow-lg" data-auto-run-control style={style}>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={t("dragAutoRunControl")}
        onPointerDown={startAutoRunControlDrag}
        onPointerMove={moveAutoRunControl}
        onPointerUp={stopAutoRunControlDrag}
        onPointerCancel={stopAutoRunControlDrag}
      >
        <MoveIcon data-icon="inline-start" />
      </Button>
      <Button
        size="icon-sm"
        variant={dirtyPromptCount ? "outline" : "ghost"}
        aria-label={t("syncFiles")}
        disabled={!hasProject}
        onClick={() => void refreshPackageFiles()}
      >
        <RefreshCwIcon data-icon="inline-start" />
      </Button>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <span>
            <Popover open={miniRunPanelOpen} onOpenChange={setMiniRunPanelOpen}>
              <PopoverTrigger asChild>
                <Button
                  data-testid="auto-run-trigger"
                  size="icon-lg"
                  variant={autoRunState?.phase === "blocked" || autoRunState?.phase === "failed" ? "destructive" : "default"}
                  aria-label={t("autoRun")}
                  disabled={!hasProject}
                  onClick={() => void handleAutoRunClick()}
                >
                  {autoRunState?.phase === "running" ? (
                    <PauseIcon data-icon="inline-start" />
                  ) : autoRunState?.phase === "pausing" ? (
                    <RefreshCwIcon className="animate-spin" data-icon="inline-start" />
                  ) : (
                    <PlayIcon data-icon="inline-start" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96" data-testid="auto-run-mini-panel">
                <PopoverHeader>
                  <PopoverTitle>{t("miniRunPanel")}</PopoverTitle>
                  <PopoverDescription>{selectedProject?.name ?? t("autoRunNoProjectHint")}</PopoverDescription>
                </PopoverHeader>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{t("runStatus")}</span>
                    <Badge
                      data-phase={autoRunState?.phase ?? "idle"}
                      data-run-id={autoRunState?.runId ?? ""}
                      data-testid="auto-run-mini-status"
                      variant={autoRunState?.phase === "blocked" || autoRunState?.phase === "failed" ? "destructive" : "outline"}
                    >
                      {autoRunState?.phase ?? t("miniPanelEmpty")}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>
                      {t("currentBlock")}: {explanation?.currentRef ?? "-"}
                    </span>
                    <span>
                      {t("agent")}: {explanation?.currentExecutor ?? "-"}
                    </span>
                    <span>
                      {t("elapsedTime")}: {autoRunState ? formatElapsed(autoRunState.elapsedMs) : "-"}
                    </span>
                    <span>
                      {t("stepCount")}: {autoRunState ? `${autoRunState.stepCount}` : "-"}
                    </span>
                  </div>
                  {showFailureDetails ? <AutoRunFailureDetails state={autoRunState} t={t} /> : null}
                  {!showFailureDetails && explanation?.latestOutputSummary ? (
                    <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                      {t("latestOutput")}: {explanation.latestOutputSummary}
                    </div>
                  ) : null}
                  {!showFailureDetails && explanation ? (
                    <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                      {t("nextAction")}: {explanation.nextAction.message}
                    </div>
                  ) : null}
                  {!showFailureDetails && explanation?.error ? (
                    <div className="rounded-md border border-destructive p-2 text-xs text-destructive" data-testid="auto-run-error">
                      {explanation.error}
                    </div>
                  ) : null}
                  <div className="flex justify-end gap-2">
                    {explanation?.latestRecordPath ? (
                      <Button
                        data-record-path={explanation.latestRecordPath}
                        data-run-id={autoRunState?.runId ?? ""}
                        data-testid="auto-run-open-record"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleRevealPathInFinder(explanation.latestRecordPath)}
                      >
                        <FolderOpenIcon data-icon="inline-start" />
                        {t("openRecord")}
                      </Button>
                    ) : null}
                    {canStop ? (
                      <Button size="sm" variant="outline" onClick={() => void stopAutoRunClick()}>
                        <SquareIcon data-icon="inline-start" />
                        {t("stop")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </span>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>{t("autoRunScope")}</ContextMenuLabel>
          <ContextMenuRadioGroup value={autoRunScopeMode} onValueChange={(value) => setAutoRunScopeMode(value as AutoRunScopeMode)}>
            <ContextMenuRadioItem disabled={!hasProject} value="project">{t("projectScope")}</ContextMenuRadioItem>
            <ContextMenuRadioItem disabled={!hasProject || (!selectedTaskPanelId && !selectedBlockPresent)} value="selectedTask">
              {t("selectedTaskScope")}
            </ContextMenuRadioItem>
            <ContextMenuRadioItem disabled={!hasProject || !selectedBlockPresent} value="selectedBlock">
              {t("selectedBlockScope")}
            </ContextMenuRadioItem>
          </ContextMenuRadioGroup>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => setMiniRunPanelOpen(true)}>{t("miniRunPanel")}</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {canStop ? (
        <Button size="icon-sm" variant="outline" aria-label={t("stop")} onClick={() => void stopAutoRunClick()}>
          <SquareIcon data-icon="inline-start" />
        </Button>
      ) : null}
      {!hasProject ? <span className="max-w-[180px] text-xs text-muted-foreground">{t("autoRunNoProjectHint")}</span> : null}
      <Select value={autoRunScopeMode} onValueChange={(value) => setAutoRunScopeMode(value as AutoRunScopeMode)}>
        <SelectTrigger className="h-9 w-36" disabled={!hasProject}>
          <SelectValue aria-label={t("autoRunScope")} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="project">{t("projectScope")}</SelectItem>
            <SelectItem disabled={!selectedTaskPanelId && !selectedBlockPresent} value="selectedTask">
              {t("selectedTaskScope")}
            </SelectItem>
            <SelectItem disabled={!selectedBlockPresent} value="selectedBlock">
              {t("selectedBlockScope")}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Badge variant={autoRunState?.phase === "blocked" || autoRunState?.phase === "failed" ? "destructive" : "outline"}>
        {autoRunState?.phase ?? t("autoRunStopped")}
      </Badge>
    </div>
  );
}
