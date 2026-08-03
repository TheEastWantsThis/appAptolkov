import { ArrowLeft, FileCheck, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import {
  MeasurementForm,
  type RoomDraft,
} from "@/components/measurements/measurement-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { requireAuthContext } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";
import { getMeasurement } from "@/modules/measurements/application/queries";

export default async function MeasurementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireAuthContext();
  const measurement = await getMeasurement(id);
  if (!measurement) notFound();
  const rooms: RoomDraft[] = measurement.rooms.map((room) => ({
    localId: room.id,
    name: room.name,
    areaMode: room.areaMode,
    length: Number(room.length ?? 0),
    width: Number(room.width ?? 0),
    area: Number(room.area ?? 0),
    perimeter: Number(room.perimeter ?? 0),
    height: Number(room.height ?? 0),
    corners: room.corners,
    canvasType: room.canvasType ?? "BASE",
    manufacturer: room.manufacturer ?? "",
    color: room.color ?? "",
    texture: room.texture ?? "",
    profileType: room.profileType ?? "BASE",
    profileLength: Number(room.profileLength ?? 0),
    insertLength: Number(room.insertLength ?? 0),
    pipes: room.pipes,
    lights: room.lights,
    chandeliers: room.chandeliers,
    tracks: Number(room.tracks),
    cornices: Number(room.cornices),
    niches: Number(room.niches),
    ventilation: room.ventilation,
    sensors: room.sensors,
    cabinetBypass: Number(room.cabinetBypass),
    additionalWorks: room.additionalWorks ?? "",
    additionalWorkUnits: Number(room.additionalWorkUnits),
    complexityCoefficient: Number(room.complexityCoefficient),
    comment: room.comment ?? "",
    photos: room.media.filter((m) => m.type === "PHOTO").map((m) => m.url),
    drawing: room.media.find((m) => m.type === "DRAWING")?.url ?? "",
  }));
  const canCreateEstimate = hasPermission(
    context.permissions,
    PERMISSIONS.ESTIMATE_CREATE,
  );
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/measurements">
          <ArrowLeft />К календарю
        </Link>
      </Button>
      <PageHeader
        title={`Замер · ${measurement.project.number}`}
        description={`${formatDateTime(measurement.scheduledAt)} · ${measurement.measurer.name}`}
        action={<Badge>{measurement.status}</Badge>}
      />
      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
          <div className="flex gap-2 text-sm">
            <MapPin className="size-4" />
            <div>
              <b>{measurement.project.address}</b>
              <div className="text-muted-foreground">
                {measurement.district || "Район не указан"} ·{" "}
                {measurement.objectType || "Тип не указан"}
              </div>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">
              Комментарий оператора
            </div>
            <p className="text-sm">
              {measurement.operatorComment || "Нет комментария"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <div className="mb-2 flex gap-2 text-sm font-bold">
              <FileCheck className="size-4" />
              Необходимые документы
            </div>
            <div className="flex flex-wrap gap-2">
              {measurement.requiredDocuments.map((d) => (
                <Badge key={d} variant="outline">
                  {d}
                </Badge>
              ))}
              {measurement.requiredDocuments.length === 0 ? (
                <span className="text-muted-foreground text-sm">
                  Не указаны
                </span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
      <MeasurementForm
        measurementId={measurement.id}
        initialRooms={rooms}
        canEdit={measurement.canEdit}
        canCreateEstimate={canCreateEstimate}
        completed={measurement.status === "COMPLETED"}
      />
    </div>
  );
}
