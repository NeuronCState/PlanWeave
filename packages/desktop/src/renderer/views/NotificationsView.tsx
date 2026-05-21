import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { createTranslator } from "../i18n";
import type { NotificationItem } from "../types";

type NotificationsViewProps = {
  notificationItems: NotificationItem[];
  t: ReturnType<typeof createTranslator>;
};

export function NotificationsView({ notificationItems, t }: NotificationsViewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notifications")}</CardTitle>
        <CardDescription>{notificationItems.length > 0 ? `${t("activeRules")}: ${notificationItems.length}` : t("noNotificationsFiltered")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {notificationItems.length === 0 ? <div className="text-sm text-muted-foreground">{t("noNotifications")}</div> : null}
        {notificationItems.map((item) => (
          <div className="flex items-start justify-between gap-3 rounded-md border p-3" key={item.id}>
            <div className="min-w-0">
              <div className="text-sm font-medium">{item.title}</div>
              <div className="break-words text-xs text-muted-foreground">{item.detail}</div>
            </div>
            <Badge variant={item.tone}>{item.tone}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
