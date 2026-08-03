import type { Metadata } from "next";
import { ScrollText } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { listAuditLogs } from "@/modules/audit/application/queries";
import { requirePagePermission } from "@/modules/auth/application/page-access";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";

export const metadata: Metadata = { title: "Журнал действий" };

export default async function AuditPage() {
  await requirePagePermission(PERMISSIONS.AUDIT_READ);
  const entries = await listAuditLogs();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Журнал действий"
        description="Последние 100 важных изменений. Пароли и чувствительные данные в журнал не записываются."
        action={
          <Badge variant="outline">Append-only на уровне приложения</Badge>
        }
      />
      <div className="grid gap-3 md:hidden">
        {entries.map((entry) => (
          <Card key={entry.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-xl">
                <ScrollText className="text-muted-foreground size-4" />
              </div>
              <div>
                <div className="text-sm font-bold">{entry.summary}</div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {entry.actor?.name ?? "Система"} ·{" "}
                  {formatDateTime(entry.occurredAt)}
                </div>
                <div className="mt-2">
                  <Badge variant="outline" className="font-mono">
                    {entry.action}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card className="hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Время</TableHead>
              <TableHead>Автор</TableHead>
              <TableHead>Действие</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead>Объект</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {formatDateTime(entry.occurredAt)}
                </TableCell>
                <TableCell className="font-semibold">
                  {entry.actor?.name ?? "Система"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono">
                    {entry.action}
                  </Badge>
                </TableCell>
                <TableCell>{entry.summary}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {entry.entityType}
                  {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}` : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {entries.length === 0 ? (
        <div className="text-muted-foreground rounded-2xl border border-dashed py-16 text-center text-sm">
          Журнал пока пуст
        </div>
      ) : null}
    </div>
  );
}
