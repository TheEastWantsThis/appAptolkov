import { ArrowLeft, Clock3, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LeadOperatorActions } from "@/components/leads/lead-operator-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { requireAuthContext } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";
import { getLead, listMeasurers } from "@/modules/leads/application/queries";

const resultLabels: Record<string, string> = {
  NO_ANSWER: "Не ответил",
  CALLBACK: "Перезвонить",
  INTERESTED: "Заинтересован",
  MEASUREMENT: "Замер",
  DECLINED: "Отказ",
  WRONG_NUMBER: "Неверный номер",
};

export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireAuthContext();
  const lead = await getLead(id);
  if (!lead) notFound();
  const canManage = hasPermission(context.permissions, PERMISSIONS.LEAD_MANAGE);
  const canCreateProject =
    hasPermission(context.permissions, PERMISSIONS.PROJECT_MANAGE) &&
    !lead.project;
  const measurers = canManage ? await listMeasurers() : [];
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/leads">
          <ArrowLeft />К списку
        </Link>
      </Button>
      <PageHeader
        title={lead.clientName || "Заявка без имени"}
        description={`Создана ${formatDateTime(lead.createdAt)} · ${lead.author.name}`}
        action={<Badge>{lead.status}</Badge>}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Контакт и запрос</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Info icon={<Phone />} label="Телефон" value={lead.phone} />
              <Info
                icon={<MapPin />}
                label="Район или адрес"
                value={lead.districtOrAddress || "Не указан"}
              />
              <Info label="Тип жилья" value={lead.housingType || "Не указан"} />
              <Info
                label="Комнат"
                value={lead.roomsApprox?.toString() || "Не указано"}
              />
              <Info
                label="Срок ремонта"
                value={lead.repairTimeline || "Не указан"}
              />
              <Info
                label="Время звонка"
                value={lead.preferredCallTime || "Не указано"}
              />
              <Info
                label="Рекламная точка"
                value={lead.adPoint || "Не указана"}
              />
              <Info
                label="Согласие"
                value={lead.contactConsent ? "Получено" : "Нет"}
              />
              {lead.comment ? (
                <div className="sm:col-span-2">
                  <div className="text-muted-foreground text-xs">
                    Комментарий
                  </div>
                  <p className="mt-1 text-sm">{lead.comment}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Журнал звонков</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lead.calls.map((call) => (
                <div key={call.id} className="rounded-xl border p-3">
                  <div className="flex justify-between gap-3">
                    <b className="text-sm">{resultLabels[call.result]}</b>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(call.calledAt)}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {call.author.name}
                  </div>
                  {call.note ? (
                    <p className="mt-2 text-sm">{call.note}</p>
                  ) : null}
                  {call.nextContactAt ? (
                    <p className="mt-2 text-xs">
                      Следующий контакт: {formatDateTime(call.nextContactAt)}
                    </p>
                  ) : null}
                </div>
              ))}
              {lead.calls.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Звонков пока не было
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Задачи</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lead.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 rounded-xl border p-3"
                >
                  <Clock3 className="mt-0.5 size-4" />
                  <div>
                    <div className="text-sm font-semibold">{task.title}</div>
                    <div className="text-muted-foreground text-xs">
                      {task.assignee?.name || "Без исполнителя"}
                      {task.dueAt ? ` · ${formatDateTime(task.dueAt)}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        {canManage ? (
          <aside>
            <LeadOperatorActions
              leadId={lead.id}
              phone={lead.phone}
              canCall={lead.canReadPhone}
              measurers={measurers}
              canCreateProject={canCreateProject}
              defaultName={lead.clientName || ""}
              defaultAddress={lead.districtOrAddress || ""}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
function Info({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
        {icon ? <span className="[&>svg]:size-4">{icon}</span> : null}
        {value}
      </div>
    </div>
  );
}
