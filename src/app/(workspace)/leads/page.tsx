import { AlertCircle, Clock3, MapPin, Plus, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";
import { requireAuthContext } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";
import { listLeads } from "@/modules/leads/application/queries";

const labels: Record<string, string> = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  CONTACTED: "Связались",
  QUALIFIED: "Квалифицирована",
  DECLINED: "Отказ",
  CONVERTED: "Создан проект",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    due?: "overdue" | "today" | "future";
    q?: string;
  }>;
}) {
  const context = await requireAuthContext();
  const canRead =
    hasPermission(context.permissions, PERMISSIONS.LEAD_READ) ||
    hasPermission(context.permissions, PERMISSIONS.LEAD_OWN_READ);
  if (!canRead) redirect("/403");
  const canCreate = hasPermission(context.permissions, PERMISSIONS.LEAD_CREATE);
  const filters = await searchParams;
  const leads = await listLeads({
    status: filters.status,
    due: filters.due,
    search: filters.q,
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Лиды"
        description={
          hasPermission(context.permissions, PERMISSIONS.LEAD_READ)
            ? "Очередь новых заявок и запланированных контактов"
            : "Ваши зарегистрированные заявки"
        }
        action={
          canCreate ? (
            <Button asChild>
              <Link href="/leads/new">
                <Plus /> Новая заявка
              </Link>
            </Button>
          ) : undefined
        }
      />
      <form className="grid gap-2 rounded-2xl border bg-white p-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-3 left-3 size-4" />
          <Input
            name="q"
            defaultValue={filters.q}
            className="pl-9"
            placeholder="Имя или адрес"
          />
        </div>
        <select
          name="status"
          defaultValue={filters.status}
          className="border-input h-10 rounded-md border px-3 text-sm"
        >
          <option value="">Все статусы</option>
          {Object.entries(labels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          name="due"
          defaultValue={filters.due}
          className="border-input h-10 rounded-md border px-3 text-sm"
        >
          <option value="">Любой срок</option>
          <option value="overdue">Просрочено</option>
          <option value="today">Сегодня</option>
          <option value="future">Позже</option>
        </select>
        <Button type="submit" variant="secondary" className="sm:col-span-3">
          Применить фильтры
        </Button>
      </form>
      <div className="grid gap-3 xl:grid-cols-2">
        {leads.map((lead) => {
          const task = lead.tasks[0];
          const overdue = task?.dueAt && task.dueAt < new Date();
          return (
            <Link key={lead.id} href={`/leads/${lead.id}`}>
              <Card className="h-full transition hover:border-blue-300 hover:shadow-md">
                <CardContent className="space-y-3 pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold">
                        {lead.clientName || "Имя не указано"}
                      </div>
                      <div className="text-primary mt-1 font-semibold">
                        {lead.phone}
                      </div>
                    </div>
                    <Badge
                      variant={
                        lead.status === "DECLINED"
                          ? "destructive"
                          : lead.status === "QUALIFIED"
                            ? "success"
                            : "outline"
                      }
                    >
                      {labels[lead.status]}
                    </Badge>
                  </div>
                  {lead.districtOrAddress ? (
                    <div className="text-muted-foreground flex gap-2 text-sm">
                      <MapPin className="size-4 shrink-0" />
                      {lead.districtOrAddress}
                    </div>
                  ) : null}
                  <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span>Автор: {lead.author.name}</span>
                    <span>{formatDateTime(lead.createdAt)}</span>
                  </div>
                  {task ? (
                    <div
                      className={`flex items-center gap-2 rounded-xl p-2 text-xs ${overdue ? "bg-red-50 text-red-700" : "bg-muted"}`}
                    >
                      {overdue ? (
                        <AlertCircle className="size-4" />
                      ) : (
                        <Clock3 className="size-4" />
                      )}
                      {task.title}
                      {task.dueAt ? ` · ${formatDateTime(task.dueAt)}` : ""}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
      {leads.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center">
          Заявок по выбранным условиям нет
        </p>
      ) : null}
    </div>
  );
}
