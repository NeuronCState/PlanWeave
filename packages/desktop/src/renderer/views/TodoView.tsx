import type { DesktopTodoGroups } from "@planweave/runtime";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TodoGroupCard } from "../components/TodoGroupCard";
import type { createTranslator } from "../i18n";

type TodoViewProps = {
  handleBlockSelect: (ref: string) => Promise<void>;
  t: ReturnType<typeof createTranslator>;
  todoGroups: DesktopTodoGroups | null;
};

export function TodoView({ handleBlockSelect, t, todoGroups }: TodoViewProps) {
  return (
    <ScrollArea className="h-full">
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
                    parallelSafety: t("parallelSafety")
                  }}
                  onSelect={(ref) => void handleBlockSelect(ref)}
                  status={status}
                />
              ))
          : null}
      </div>
    </ScrollArea>
  );
}
