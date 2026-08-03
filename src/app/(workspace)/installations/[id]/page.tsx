import {
  ArrowLeft,
  Camera,
  Car,
  ClipboardList,
  ExternalLink,
  Hammer,
  MapPin,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  InstallationProgressForm,
  RepeatInstallationForm,
} from "@/components/installations/installation-progress-form";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { getSafeInstallation } from "@/modules/installations/application/queries";
import {
  INSTALLATION_STATUS_LABELS,
  type InstallationStatusValue,
} from "@/modules/installations/domain/state-machine";

function localInput(date: Date | null) {
  if (!date) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export default async function InstallationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const installation = await getSafeInstallation(id);
  if (!installation) notFound();
  const navigationUrl =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(installation.project.address);
  const measurementPhotos = installation.project.rooms.flatMap((room) =>
    room.media.map((media) => ({ ...media, room: room.name })),
  );
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/installations">
          <ArrowLeft />К монтажам
        </Link>
      </Button>
      <PageHeader
        title={"Монтаж · " + installation.project.number}
        description={
          formatDateTime(installation.startsAt) +
          " — " +
          formatDateTime(installation.endsAt)
        }
        action={
          <Badge
            variant={
              installation.status === "COMPLETED" ? "success" : "outline"
            }
          >
            {INSTALLATION_STATUS_LABELS[installation.status]}
          </Badge>
        }
      />

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
          <div className="flex gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <div>
              <b>{installation.project.address}</b>
              <div>
                <a
                  href={navigationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1 font-semibold"
                >
                  Открыть навигацию <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          </div>
          <div className="flex gap-2 text-sm">
            <Users className="size-4 shrink-0" />
            {installation.participants
              .map(
                ({ user, isForeman }) =>
                  user.name + (isForeman ? " · бригадир" : ""),
              )
              .join(", ")}
          </div>
          <div className="flex gap-2 text-sm">
            <Car className="size-4" />
            {installation.vehicle || "Транспорт не указан"}
          </div>
          <div className="text-sm">
            <b>Особые условия:</b>{" "}
            {installation.specialConditions || "не указаны"}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 pt-5">
            <h2 className="flex gap-2 font-bold">
              <ClipboardList className="size-5" />
              Техническое задание
            </h2>
            <p className="text-sm whitespace-pre-wrap">
              {installation.technicalBrief}
            </p>
            {installation.crewComment ? (
              <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-950">
                <b>Комментарий бригаде:</b> {installation.crewComment}
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
            <div>
              <h2 className="mb-2 flex gap-2 font-bold">
                <Hammer className="size-5" />
                Материалы
              </h2>
              <ul className="list-inside list-disc text-sm">
                {installation.plannedMaterials.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-2 flex gap-2 font-bold">
                <Wrench className="size-5" />
                Инструменты
              </h2>
              <ul className="list-inside list-disc text-sm">
                {installation.plannedTools.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-bold">Помещения</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {installation.project.rooms.map((room) => (
            <Card key={room.id}>
              <CardContent className="space-y-2 pt-5 text-sm">
                <b>{room.name}</b>
                <div className="text-muted-foreground">
                  {room.area ? Number(room.area) + " м²" : "Площадь не указана"}
                  {" · "}
                  {room.canvasType || "полотно не указано"}
                </div>
                <div>{room.profileType || "Профиль не указан"}</div>
                {room.comment ? <p>{room.comment}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex gap-2 font-bold">
          <Camera className="size-5" />
          Фотографии замера
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {measurementPhotos.map((photo) => (
            <a
              key={photo.id}
              href={photo.url}
              target="_blank"
              rel="noreferrer"
              className="overflow-hidden rounded-xl border"
            >
              <div
                className="aspect-square bg-slate-100 bg-cover bg-center"
                style={{
                  backgroundImage: "url(" + JSON.stringify(photo.url) + ")",
                }}
              />
              <div className="p-2 text-xs">{photo.room}</div>
            </a>
          ))}
        </div>
        {measurementPhotos.length === 0 ? (
          <p className="text-muted-foreground text-sm">Фотографий нет</p>
        ) : null}
      </section>

      {installation.canManageProgress ? (
        <>
          <InstallationProgressForm
            installationId={installation.id}
            initialStatus={installation.status as InstallationStatusValue}
            initial={{
              actualStartedAt: localInput(installation.actualStartedAt),
              actualEndedAt: localInput(installation.actualEndedAt),
              beforePhotos: installation.media
                .filter((item) => item.type === "BEFORE")
                .map((item) => item.url),
              processPhotos: installation.media
                .filter((item) => item.type === "PROCESS")
                .map((item) => item.url),
              afterPhotos: installation.media
                .filter((item) => item.type === "AFTER")
                .map((item) => item.url),
              usedMaterials: installation.usedMaterials.map((item) => ({
                name: item.name,
                quantity: Number(item.quantity),
                unit: item.unit,
              })),
              workComment: installation.workComment ?? "",
              issues: installation.issues ?? "",
              responsibleSignature: installation.responsibleSignature ?? "",
              accepted: Boolean(installation.acceptedAt),
            }}
          />
          <RepeatInstallationForm installationId={installation.id} />
        </>
      ) : (
        <p className="text-muted-foreground rounded-xl border p-4 text-sm">
          Ход монтажа может менять только назначенный участник бригады.
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Завершение монтажа не закрывает проект автоматически. Финансовые и
        административные условия проверяются отдельно.
      </p>
    </div>
  );
}
