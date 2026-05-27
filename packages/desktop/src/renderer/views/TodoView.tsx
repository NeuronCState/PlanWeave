import type { DesktopProjectExecutionPlan, DesktopTodoGroups } from "@planweave/runtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TodoGroupCard } from "../components/TodoGroupCard";
import type { createTranslator } from "../i18n";

type TodoViewProps = {
  executionPlan: DesktopProjectExecutionPlan | null;
  handleBlockSelect: (ref: string, canvasId?: string | null) => Promise<void>;
  t: ReturnType<typeof createTranslator>;
  todoGroups: DesktopTodoGroups | null;
};

export function TodoView({ executionPlan, handleBlockSelect, t, todoGroups }: TodoViewProps) {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4">
        {executionPlan ? (
          <section className="rounded-lg border bg-background p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">{t("canvasPhases")}</h2>
                <p className="text-xs text-muted-foreground">{executionPlan.notes[0]}</p>
              </div>
              <Badge variant="secondary">
                {t("readyQueue")}: {executionPlan.readyQueue.length}
              </Badge>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {executionPlan.phases.map((phase) => (
                <div className="rounded-md border p-3" key={phase.canvasId}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-muted-foreground">
                        {t("phase")} {phase.phaseIndex}
                      </div>
                      <div className="truncate text-sm font-semibold">{phase.canvasName}</div>
                    </div>
                    <Badge variant="outline">
                      {t("ready")}: {phase.readyQueue.length}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <span>{t("parallelSafe")}: {phase.parallelReadyQueue.length}</span>
                    <span>{t("parallelBlocked")}: {phase.sequentialReadyQueue.length}</span>
                    <span>{t("blocked")}: {phase.blockedCount}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {phase.readyQueue.length > 0 ? (
                      phase.readyQueue.map((item) => (
                        <Button key={`${item.canvasId}:${item.ref}`} size="sm" variant="outline" onClick={() => void handleBlockSelect(item.ref, item.canvasId)}>
                          {item.ref}
                        </Button>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("noReadyBlocks")}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        <div className="grid grid-cols-3 gap-3">
        {todoGroups
          ? Object.entries(todoGroups)
              .filter(([status]) => ["ready", "in_progress", "needs_changes", "blocked", "diverged", "implemented"].includes(status))
              .map(([status, items]) => (
                <TodoGroupCard
                  items={items}
                  key={status}
                  labels={{
                    dependencyBlockers: t("dependencyBlockers"),
                    locks: t("locks"),
                    noBlockers: t("noBlockers"),
                    noLocks: t("noLocks"),
                    parallelBlocked: t("parallelBlocked"),
                    parallelSafe: t("parallelSafe"),
                    parallelSafety: t("parallelSafety"),
                    reviewExecutor: t("reviewExecutor"),
                    reviewGate: t("reviewGate"),
                    reviewNeedsChangesReturnsTo: t("reviewNeedsChangesReturnsTo"),
                    reviewRequired: t("reviewRequired"),
                    reviewUnlocks: t("reviewUnlocks")
                  }}
                  onSelect={(item) => void handleBlockSelect(item.ref, item.canvasId)}
                  status={status}
                />
              ))
          : null}
        </div>
      </div>
    </ScrollArea>
  );
}
