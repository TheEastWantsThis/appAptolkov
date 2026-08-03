import { CalendarDays, MapPin, Ruler } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { listAssignedMeasurements } from "@/modules/measurements/application/queries";

const labels: Record<string, string> = {
  SCHEDULED: "Назначен",
  DRAFT: "Черновик",
  IN_PROGRESS: "В работе",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
};
export default async function MeasurementsPage() {
  const measurements = await listAssignedMeasurements();
  const groups = new Map<string, typeof measurements>();
  for (const item of measurements) {
    const key = item.scheduledAt.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Мои замеры"
        description="Календарь назначенных выездов. Телефоны и финансовые данные здесь не отображаются."
      />
      {[...groups.entries()].map(([date, items]) => (
        <section key={date}>
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            <CalendarDays className="text-primary size-5" />
            {date}
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((m) => (
              <Link key={m.id} href={`/measurements/${m.id}`}>
                <Card className="transition hover:border-blue-300 hover:shadow-md">
                  <CardContent className="space-y-3 pt-5">
                    <div className="flex justify-between gap-3">
                      <div>
                        <b>{m.project.number}</b>
                        <div className="text-muted-foreground text-sm">
                          {m.project.customer.name}
                        </div>
                      </div>
                      <Badge
                        variant={
                          m.status === "COMPLETED" ? "success" : "outline"
                        }
                      >
                        {labels[m.status]}
                      </Badge>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <CalendarDays className="size-4" />
                      {formatDateTime(m.scheduledAt)}
                    </div>
                    <div className="text-muted-foreground flex gap-2 text-sm">
                      <MapPin className="size-4 shrink-0" />
                      {m.project.address}
                      {m.district ? ` · ${m.district}` : ""}
                    </div>
                    <div className="text-muted-foreground flex gap-2 text-sm">
                      <Ruler className="size-4" />
                      {m.objectType || "Тип объекта не указан"} ·{" "}
                      {m._count.rooms} помещ.
                    </div>
                    {m.operatorComment ? (
                      <p className="bg-muted rounded-xl p-3 text-sm">
                        {m.operatorComment}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {measurements.length === 0 ? (
        <p className="text-muted-foreground py-20 text-center">
          Назначенных замеров нет
        </p>
      ) : null}
    </div>
  );
}
