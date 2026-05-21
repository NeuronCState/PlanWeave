import type { CSSProperties, Dispatch, PointerEvent, SetStateAction } from "react";
import type { DesktopAutoRunState, DesktopProjectSummary } from "@planweave/runtime";
import { FolderOpenIcon, MoveIcon, PauseIcon, PlayIcon, SquareIcon } from "lucide-react";
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
  handleAutoRunClick: () => Promise<void>;
  handleOpenRunRecord: (recordId: string | null | undefined) => Promise<void>;
  miniRunPanelOpen: boolean;
  moveAutoRunControl: (event: PointerEvent<HTMLButtonElement>) => void;
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

export function FloatingAutoRunControl({
  autoRunScopeMode,
  autoRunState,
  handleAutoRunClick,
  handleOpenRunRecord,
  miniRunPanelOpen,
  moveAutoRunControl,
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
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <span>
            <Popover open={miniRunPanelOpen} onOpenChange={setMiniRunPanelOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="icon-lg"
                  variant={autoRunState?.phase === "blocked" || autoRunState?.phase === "failed" ? "destructive" : "default"}
                  aria-label={t("autoRun")}
                  onClick={() => void handleAutoRunClick()}
                >
                  {autoRunState?.phase === "running" ? <PauseIcon data-icon="inline-start" /> : <PlayIcon data-icon="inline-start" />}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96">
                <PopoverHeader>
                  <PopoverTitle>{t("miniRunPanel")}</PopoverTitle>
                  <PopoverDescription>{selectedProject?.name ?? t("noProject")}</PopoverDescription>
                </PopoverHeader>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{t("runStatus")}</span>
                    <Badge variant={autoRunState?.phase === "blocked" || autoRunState?.phase === "failed" ? "destructive" : "outline"}>
                      {autoRunState?.phase ?? t("miniPanelEmpty")}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>
                      {t("currentBlock")}: {autoRunState?.currentRef ?? "-"}
                    </span>
                    <span>
                      {t("agent")}: {autoRunState?.currentExecutor ?? "-"}
                    </span>
                    <span>
                      {t("elapsedTime")}: {autoRunState ? formatElapsed(autoRunState.elapsedMs) : "-"}
                    </span>
                    <span>
                      {t("stepCount")}: {autoRunState ? `${autoRunState.stepCount}` : "-"}
                    </span>
                  </div>
                  {autoRunState?.latestOutputSummary ? (
                    <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                      {t("latestOutput")}: {autoRunState.latestOutputSummary}
                    </div>
                  ) : null}
                  {autoRunState?.error ? <div className="rounded-md border border-destructive p-2 text-xs text-destructive">{autoRunState.error}</div> : null}
                  <div className="flex justify-end gap-2">
                    {autoRunState?.latestRecordId ? (
                      <Button size="sm" variant="outline" onClick={() => void handleOpenRunRecord(autoRunState.latestRecordId)}>
                        <FolderOpenIcon data-icon="inline-start" />
                        {t("openRecord")}
                      </Button>
                    ) : null}
                    {autoRunState && ["running", "paused", "manual", "blocked", "failed"].includes(autoRunState.phase) ? (
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
            <ContextMenuRadioItem value="project">{t("projectScope")}</ContextMenuRadioItem>
            <ContextMenuRadioItem disabled={!selectedTaskPanelId && !selectedBlockPresent} value="selectedTask">
              {t("selectedTaskScope")}
            </ContextMenuRadioItem>
            <ContextMenuRadioItem disabled={!selectedBlockPresent} value="selectedBlock">
              {t("selectedBlockScope")}
            </ContextMenuRadioItem>
          </ContextMenuRadioGroup>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => setMiniRunPanelOpen(true)}>{t("miniRunPanel")}</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <Select value={autoRunScopeMode} onValueChange={(value) => setAutoRunScopeMode(value as AutoRunScopeMode)}>
        <SelectTrigger className="h-9 w-36">
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
