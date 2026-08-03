import { Bell } from "lucide-react";

import {
  MarkAllNotifications,
  NotificationActions,
  NotificationLink,
} from "@/components/notifications";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { listNotifications } from "@/modules/notifications/application/queries";
import { requirePagePermission } from "@/modules/auth/application/page-access";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";

export default async function NotificationsPage() {
  await requirePagePermission(PERMISSIONS.NOTIFICATION_READ);
  const notifications = await listNotifications();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Уведомления"
        description="Назначения, сроки, дефицит и важные события"
        action={<MarkAllNotifications />}
      />
      <div className="space-y-3">
        {notifications.map((notification) => (
          <Card
            key={notification.id}
            className={notification.readAt ? "opacity-65" : "border-blue-300"}
          >
            <CardContent className="flex items-start gap-3 pt-5">
              <Bell className="text-primary mt-1 size-5 shrink-0" />
              <NotificationLink href={notification.href}>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{notification.title}</b>
                    {!notification.readAt ? <Badge>Новое</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm">{notification.body}</p>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {formatDateTime(notification.createdAt)}
                  </div>
                </div>
              </NotificationLink>
              {!notification.readAt ? (
                <NotificationActions id={notification.id} />
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      {notifications.length === 0 ? (
        <p className="text-muted-foreground py-20 text-center">
          Уведомлений пока нет
        </p>
      ) : null}
    </div>
  );
}
