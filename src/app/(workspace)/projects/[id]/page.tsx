import {
  ArrowLeft,
  CalendarDays,
  FileText,
  History,
  MapPin,
  Phone,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { ProjectControls } from "@/components/projects/project-controls";
import { TaskDoneButton } from "@/components/projects/task-done-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import {
  getProject,
  listAssignableUsers,
} from "@/modules/projects/application/queries";
import { listMeasurers } from "@/modules/leads/application/queries";
import { PROJECT_STATUS_LABELS } from "@/modules/projects/domain/state-machine";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const [users, measurers] = project.canManage
    ? await Promise.all([listAssignableUsers(), listMeasurers()])
    : [[], []];
  const events = [
    ...project.statusHistory.map((x) => ({
      id: `s-${x.id}`,
      at: x.changedAt,
      title: `Статус: ${PROJECT_STATUS_LABELS[x.toStatus]}`,
      text: x.comment || x.changedBy.name,
    })),
    ...project.assignmentHistory.map((x) => ({
      id: `a-${x.id}`,
      at: x.changedAt,
      title: "Назначение ответственного",
      text: `${x.user?.name || "Пользователь"} · ${x.roleLabel}`,
    })),
    ...project.comments.map((x) => ({
      id: `c-${x.id}`,
      at: x.createdAt,
      title: `Комментарий · ${x.author.name}`,
      text: x.body,
    })),
    ...project.events.map((x) => ({
      id: `e-${x.id}`,
      at: x.createdAt,
      title: `Событие: ${x.title}`,
      text: `${formatDateTime(x.startsAt)} · ${x.assignee?.name || "Без ответственного"}`,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/projects">
          <ArrowLeft />К проектам
        </Link>
      </Button>
      <PageHeader
        title={project.number}
        description={project.customer.name}
        action={
          <Badge variant="success">
            {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Карточка проекта</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Info
                icon={<Phone />}
                label="Телефон"
                value={project.customer.phone}
              />
              <Info icon={<MapPin />} label="Адрес" value={project.address} />
              <Info label="Источник" value={project.source} />
              <Info label="Создан" value={formatDateTime(project.createdAt)} />
              {project.description ? (
                <div className="text-sm sm:col-span-2">
                  {project.description}
                </div>
              ) : null}
            </CardContent>
          </Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex gap-2">
                  <Users />
                  Ответственные
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {project.responsibles.map((r) => (
                  <div
                    key={`${r.userId}-${r.roleLabel}`}
                    className="rounded-xl border p-3"
                  >
                    <b className="text-sm">{r.user.name}</b>
                    <div className="text-muted-foreground text-xs">
                      {r.roleLabel}
                    </div>
                  </div>
                ))}
                {project.responsibles.length === 0 ? <Empty /> : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Помещения</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {project.rooms.map((r) => (
                  <div
                    key={r.id}
                    className="flex justify-between rounded-xl border p-3 text-sm"
                  >
                    <b>{r.name}</b>
                    <span>{r.area ? `${r.area} м²` : "Без площади"}</span>
                  </div>
                ))}
                {project.rooms.length === 0 ? <Empty /> : null}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Задачи</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {project.tasks.map((t) => (
                <div
                  key={t.id}
                  className={`rounded-xl border p-3 ${t.dueAt && t.dueAt < new Date() && t.status !== "DONE" ? "border-red-200 bg-red-50" : ""}`}
                >
                  <div className="flex justify-between gap-3">
                    <b className="text-sm">{t.title}</b>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline">{t.status}</Badge>
                      {project.canManage &&
                      t.status !== "DONE" &&
                      t.status !== "CANCELLED" ? (
                        <TaskDoneButton taskId={t.id} projectId={project.id} />
                      ) : null}
                    </div>
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {t.assignee?.name || "Без исполнителя"}
                    {t.dueAt ? ` · ${formatDateTime(t.dueAt)}` : ""}
                  </div>
                </div>
              ))}
              {project.tasks.length === 0 ? <Empty /> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex gap-2">
                <History />
                Лента проекта
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="before:bg-border relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-2 before:w-px">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="relative pl-8 before:absolute before:top-1 before:left-0 before:size-4 before:rounded-full before:border-4 before:border-white before:bg-blue-500"
                  >
                    <div className="text-sm font-bold">{event.title}</div>
                    <p className="mt-1 text-sm">{event.text}</p>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {formatDateTime(event.at)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex gap-2">
                <FileText />
                Файлы
              </CardTitle>
            </CardHeader>
            <CardContent>
              {project.files.map((f) => (
                <div key={f.id} className="border-b py-2 text-sm">
                  {f.name} · {Math.ceil(f.size / 1024)} КБ
                </div>
              ))}
              {project.files.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Файлы ещё не прикреплены. Метаданные и права хранения
                  подготовлены.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex gap-2">
                <CalendarDays />
                Ближайшие события
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {project.events.slice(0, 5).map((e) => (
                <div key={e.id} className="bg-muted rounded-xl p-3 text-sm">
                  <b>{e.title}</b>
                  <div className="text-muted-foreground text-xs">
                    {formatDateTime(e.startsAt)}
                  </div>
                </div>
              ))}
              {project.events.length === 0 ? <Empty /> : null}
            </CardContent>
          </Card>
        </aside>
      </div>
      {project.canManage ? (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Управление проектом</h2>
          <ProjectControls
            projectId={project.id}
            status={project.status}
            users={users}
            measurers={measurers}
          />
        </section>
      ) : null}
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
      <div className="mt-1 flex gap-2 text-sm font-semibold">
        {icon ? <span className="[&>svg]:size-4">{icon}</span> : null}
        {value}
      </div>
    </div>
  );
}
function Empty() {
  return (
    <p className="text-muted-foreground py-3 text-center text-sm">
      Пока нет данных
    </p>
  );
}
