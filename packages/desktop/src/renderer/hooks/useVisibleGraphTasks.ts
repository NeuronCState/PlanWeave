import { useMemo } from "react";
import type { DesktopGraphViewModel } from "@planweave/runtime";

export function useVisibleGraphTasks(
  graph: DesktopGraphViewModel | null,
  searchQuery: string,
  selectedTaskPanelId: string | null
) {
  const visibleTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return graph?.tasks.filter((task) => {
      const matchesQuery = !query || task.title.toLowerCase().includes(query) || task.taskId.toLowerCase().includes(query);
      const matchesPanel = !selectedTaskPanelId || task.taskId === selectedTaskPanelId;
      return matchesQuery && matchesPanel;
    });
  }, [graph, searchQuery, selectedTaskPanelId]);

  const visibleTaskIds = useMemo(() => new Set(visibleTasks?.map((task) => task.taskId) ?? []), [visibleTasks]);

  return { visibleTaskIds, visibleTasks };
}
