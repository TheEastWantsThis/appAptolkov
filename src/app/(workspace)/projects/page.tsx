import {
  AlertTriangle,
  Columns3,
  List,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
} from "@/modules/projects/domain/state-machine";
import { listProjects } from "@/modules/projects/application/queries";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    view?: "kanban" | "table";
    sort?: "updated" | "created" | "number";
  }>;
}) {
  const filters = await searchParams;
  const view = filters.view ?? "kanban";
  const projects = await listProjects({
    search: filters.q,
    status: filters.status,
    sort: filters.sort,
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Проекты"
        description="Клиентские проекты, этапы работ и просроченные задачи"
        action={
          <div className="flex gap-1">
            <Button
              asChild
              size="icon"
              variant={view === "kanban" ? "default" : "outline"}
            >
              <Link
                href={{ query: { ...filters, view: "kanban" } }}
                aria-label="Канбан"
              >
                <Columns3 />
              </Link>
            </Button>
            <Button
              asChild
              size="icon"
              variant={view === "table" ? "default" : "outline"}
            >
              <Link
                href={{ query: { ...filters, view: "table" } }}
                aria-label="Таблица"
              >
                <List />
              </Link>
            </Button>
          </div>
        }
      />
      <form className="grid gap-2 rounded-2xl border bg-white p-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-3 left-3 size-4" />
          <Input
            name="q"
            defaultValue={filters.q}
            className="pl-9"
            placeholder="Номер, клиент или адрес"
          />
        </div>
        <select
          name="status"
          defaultValue={filters.status}
          className="border-input h-10 rounded-md border px-3 text-sm"
        >
          <option value="">Все статусы</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROJECT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={filters.sort}
          className="border-input h-10 rounded-md border px-3 text-sm"
        >
          <option value="updated">Недавно изменённые</option>
          <option value="created">Новые</option>
          <option value="number">По номеру</option>
        </select>
        <input type="hidden" name="view" value={view} />
        <Button type="submit" variant="secondary" className="sm:col-span-3">
          Применить
        </Button>
      </form>
      {view === "kanban" ? (
        <div className="flex snap-x gap-4 overflow-x-auto pb-4">
          {PROJECT_STATUSES.map((status) => {
            const items = projects.filter((p) => p.status === status);
            return (
              <section
                key={status}
                className="w-[86vw] max-w-80 shrink-0 snap-start"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold">
                    {PROJECT_STATUS_LABELS[status]}
                  </h2>
                  <Badge variant="outline">{items.length}</Badge>
                </div>
                <div className="space-y-3">
                  {items.map((p) => (
                    <ProjectCard key={p.id} project={p} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <div className="hidden grid-cols-[130px_1fr_1.3fr_160px_120px] gap-3 border-b bg-slate-50 p-3 text-xs font-bold md:grid">
            <span>Номер</span>
            <span>Клиент</span>
            <span>Адрес</span>
            <span>Статус</span>
            <span>Задачи</span>
          </div>
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="grid gap-2 border-b p-4 last:border-0 md:grid-cols-[130px_1fr_1.3fr_160px_120px] md:items-center"
            >
              <b>{p.number}</b>
              <span>
                {p.customer.name}
                <small className="text-muted-foreground block">
                  {p.customer.phone}
                </small>
              </span>
              <span className="text-sm">{p.address}</span>
              <Badge variant="outline">{PROJECT_STATUS_LABELS[p.status]}</Badge>
              <span
                className={
                  p.hasOverdueTasks ? "text-red-700" : "text-muted-foreground"
                }
              >
                {p.hasOverdueTasks
                  ? "Есть просроченные"
                  : `${p.tasks.length} открытых`}
              </span>
            </Link>
          ))}
        </div>
      )}
      {projects.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center">
          Проекты не найдены
        </p>
      ) : null}
    </div>
  );
}

function ProjectCard({
  project,
}: {
  project: Awaited<ReturnType<typeof listProjects>>[number];
}) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="transition hover:border-blue-300 hover:shadow-md">
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-start justify-between">
            <b>{project.number}</b>
            {project.hasOverdueTasks ? (
              <AlertTriangle className="size-4 text-red-600" />
            ) : null}
          </div>
          <div>
            <div className="font-semibold">{project.customer.name}</div>
            <div className="text-primary text-sm">{project.customer.phone}</div>
          </div>
          <div className="text-muted-foreground flex gap-2 text-xs">
            <MapPin className="size-4 shrink-0" />
            {project.address}
          </div>
          {project.responsibles.length ? (
            <div className="text-muted-foreground flex gap-2 text-xs">
              <Users className="size-4" />
              {project.responsibles.map((r) => r.user.name).join(", ")}
            </div>
          ) : null}
          <div className="flex justify-between text-xs">
            <span>{project._count.rooms} помещ.</span>
            <span>{project.tasks.length} открытых задач</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
