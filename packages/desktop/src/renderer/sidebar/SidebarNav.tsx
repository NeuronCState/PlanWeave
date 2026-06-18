import {
  BellIcon,
  ChartNoAxesColumnIncreasingIcon,
  FilePlus2Icon,
  ListTodoIcon,
  NetworkIcon,
  SearchIcon,
  SettingsIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { createTranslator } from "../i18n";
import type { AppView, NotificationItem } from "../types";

type SidebarNavProps = {
  activeView: AppView;
  canOpenCanvasMap: boolean;
  notificationItems: NotificationItem[];
  onSelectView: (view: AppView) => void;
  t: ReturnType<typeof createTranslator>;
};

export function SidebarNav({ activeView, canOpenCanvasMap, notificationItems, onSelectView, t }: SidebarNavProps) {
  const unreadNotificationCount = notificationItems.filter((item) => !item.read).length;

  return (
    <nav className="flex flex-col gap-1 p-3 pt-1">
      <Button
        data-testid="sidebar-new-task"
        className="justify-start"
        variant={activeView === "new-task" ? "secondary" : "ghost"}
        onClick={() => onSelectView("new-task")}
      >
        <FilePlus2Icon data-icon="inline-start" />
        {t("newTask")}
      </Button>
      <Button
        data-testid="sidebar-statistics"
        className="justify-start"
        variant={activeView === "statistics" ? "secondary" : "ghost"}
        onClick={() => onSelectView("statistics")}
      >
        <ChartNoAxesColumnIncreasingIcon data-icon="inline-start" />
        {t("statistics")}
      </Button>
      <Button
        data-testid="sidebar-todo"
        className="justify-start"
        variant={activeView === "todo" ? "secondary" : "ghost"}
        onClick={() => onSelectView("todo")}
      >
        <ListTodoIcon data-icon="inline-start" />
        {t("todo")}
      </Button>
      <Button
        data-testid="sidebar-canvas-map"
        className="justify-start"
        disabled={!canOpenCanvasMap}
        variant={activeView === "canvas-map" ? "secondary" : "ghost"}
        onClick={() => onSelectView("canvas-map")}
      >
        <NetworkIcon data-icon="inline-start" />
        {t("canvasMap")}
      </Button>
      <Button
        data-testid="sidebar-search"
        className="justify-start"
        variant={activeView === "search" ? "secondary" : "ghost"}
        onClick={() => onSelectView("search")}
      >
        <SearchIcon data-icon="inline-start" />
        {t("search")}
      </Button>
      <Button
        data-testid="sidebar-notifications"
        className="justify-start"
        variant={activeView === "notifications" ? "secondary" : "ghost"}
        onClick={() => onSelectView("notifications")}
      >
        <BellIcon data-icon="inline-start" />
        {t("notifications")}
        {unreadNotificationCount > 0 ? <Badge variant="destructive">{unreadNotificationCount}</Badge> : null}
      </Button>
      <Button
        data-testid="sidebar-settings"
        className="justify-start"
        variant={activeView === "settings" ? "secondary" : "ghost"}
        onClick={() => onSelectView("settings")}
      >
        <SettingsIcon data-icon="inline-start" />
        {t("settings")}
      </Button>
    </nav>
  );
}
