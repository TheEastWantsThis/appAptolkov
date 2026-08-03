import { CalendarDays, Clock3, MapPin, Plus, Users } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { requireAuthContext } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";
import { listAssignedInstallations } from "@/modules/installations/application/queries";
import { INSTALLATION_STATUS_LABELS } from "@/modules/installations/domain/state-machine";

export default async function InstallationsPage() {
  const context = await requireAuthContext();
  const installations = await listAssignedInstallations();
  const canSchedule = hasPermission(
    context.permissions,
    PERMISSIONS.INSTALLATION_SCHEDULE,
  );
  return (
    <div className="space-y-6">
      <PageHeader
        title={canSchedule ? "Календарь монтажей" : "Мои монтажи"}
        description="Рабочие карточки не содержат телефонов клиентов, финансов и рекламных источников."
        action={
          canSchedule ? (
            <Button asChild>
              <Link href="/installations/new">
                <Plus />
                Назначить
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {installations.map((installation) => (
          <Link
            key={installation.id}
            href={"/installations/" + installation.id}
          >
            <Card className="h-full transition hover:border-blue-300 hover:shadow-md">
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <b>{installation.project.number}</b>
                    <div className="text-muted-foreground flex gap-2 text-sm">
                      <MapPin className="mt-0.5 size-4 shrink-0" />
                      {installation.project.address}
                    </div>
                  </div>
                  <Badge
                    variant={
                      installation.status === "COMPLETED"
                        ? "success"
                        : "outline"
                    }
                  >
                    {INSTALLATION_STATUS_LABELS[installation.status]}
                  </Badge>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <span className="flex gap-2">
                    <CalendarDays className="size-4" />
                    {formatDateTime(installation.startsAt)}
                  </span>
                  <span className="flex gap-2">
                    <Clock3 className="size-4" />
                    до {formatDateTime(installation.endsAt)}
                  </span>
                </div>
                <div className="flex gap-2 text-sm">
                  <Users className="size-4" />
                  {installation.participants
                    .map(
                      ({ user, isForeman }) =>
                        user.name + (isForeman ? " (бригадир)" : ""),
                    )
                    .join(", ")}
                </div>
                {installation.vehicle ? (
                  <p className="bg-muted rounded-xl p-3 text-sm">
                    Транспорт: {installation.vehicle}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {installations.length === 0 ? (
        <p className="text-muted-foreground py-20 text-center">
          Назначенных монтажей нет
        </p>
      ) : null}
    </div>
  );
}
