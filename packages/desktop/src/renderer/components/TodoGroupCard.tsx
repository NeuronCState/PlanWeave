import type { DesktopTodoItem } from "@planweave/runtime";
import { Badge } from "@/components/ui/badge";

type TodoGroupCardLabels = {
  dependencyBlockers: string;
  locks: string;
  noBlockers: string;
  noLocks: string;
  parallelBlocked: string;
  parallelSafe: string;
  parallelSafety: string;
};

export function TodoGroupCard({
  items,
  labels,
  onSelect,
  status
}: {
  status: string;
  items: DesktopTodoItem[];
  labels: TodoGroupCardLabels;
  onSelect: (ref: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{status}</span>
        <Badge variant="outline">{items.length}</Badge>
      </div>
      {items.slice(0, 6).map((item) => (
        <button
          className="flex flex-col gap-2 rounded-md bg-muted/50 px-2 py-2 text-left text-xs"
          key={item.ref}
          type="button"
          onClick={() => onSelect(item.ref)}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{item.title}</span>
            <Badge variant={item.parallelSafe ? "secondary" : "destructive"}>{item.parallelSafe ? labels.parallelSafe : labels.parallelBlocked}</Badge>
          </div>
          <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-2 gap-y-1 text-muted-foreground">
            <span>{labels.dependencyBlockers}</span>
            <span className="truncate">{item.dependencyBlockers.length ? item.dependencyBlockers.join(", ") : labels.noBlockers}</span>
            <span>{labels.parallelSafety}</span>
            <span>{item.parallelSafe ? labels.parallelSafe : labels.parallelBlocked}</span>
            <span>{labels.locks}</span>
            <span className="truncate">{item.locks.length ? item.locks.join(", ") : labels.noLocks}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
