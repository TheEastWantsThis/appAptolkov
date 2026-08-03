"use client";

import { Check, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/modules/notifications/application/actions";

export function NotificationActions({ id }: { id: string }) {
  const router = useRouter();
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label="Отметить прочитанным"
      onClick={async () => {
        const result = await markNotificationReadAction(id);
        if (!result.ok) toast.error(result.error.message);
        router.refresh();
      }}
    >
      <Check />
    </Button>
  );
}

export function MarkAllNotifications() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        const result = await markAllNotificationsReadAction();
        if (!result.ok) return toast.error(result.error.message);
        toast.success("Уведомления прочитаны");
        router.refresh();
      }}
    >
      <CheckCheck />
      Прочитать все
    </Button>
  );
}

export function NotificationLink({
  href,
  children,
}: {
  href: string | null;
  children: React.ReactNode;
}) {
  return href ? <Link href={href}>{children}</Link> : children;
}
