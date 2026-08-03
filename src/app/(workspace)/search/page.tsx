import { BriefcaseBusiness, Megaphone, Search } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { requireAuthContext } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";
import { presentPhone } from "@/modules/leads/domain/phone";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const context = await requireAuthContext();
  const { q = "" } = await searchParams;
  const term = q.trim();
  const canLeads =
    hasPermission(context.permissions, PERMISSIONS.LEAD_READ) ||
    hasPermission(context.permissions, PERMISSIONS.LEAD_OWN_READ);
  const canProjects = hasPermission(
    context.permissions,
    PERMISSIONS.PROJECT_READ,
  );
  const canPhone = hasPermission(
    context.permissions,
    PERMISSIONS.CUSTOMER_PHONE_READ,
  );
  const [leads, projects] =
    term.length >= 2
      ? await Promise.all([
          canLeads
            ? prisma.lead.findMany({
                where: {
                  ...(hasPermission(context.permissions, PERMISSIONS.LEAD_READ)
                    ? {}
                    : { authorId: context.userId }),
                  OR: [
                    { clientName: { contains: term, mode: "insensitive" } },
                    {
                      districtOrAddress: {
                        contains: term,
                        mode: "insensitive",
                      },
                    },
                    ...(canPhone
                      ? [
                          {
                            phoneNormalized: {
                              contains: term.replace(/\D/g, ""),
                            },
                          },
                        ]
                      : []),
                  ],
                },
                take: 20,
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  clientName: true,
                  phone: true,
                  districtOrAddress: true,
                  status: true,
                },
              })
            : [],
          canProjects
            ? prisma.project.findMany({
                where: {
                  OR: [
                    { number: { contains: term, mode: "insensitive" } },
                    { address: { contains: term, mode: "insensitive" } },
                    {
                      customer: {
                        name: { contains: term, mode: "insensitive" },
                      },
                    },
                  ],
                },
                take: 20,
                orderBy: { updatedAt: "desc" },
                select: {
                  id: true,
                  number: true,
                  address: true,
                  status: true,
                  customer: { select: { name: true, phone: true } },
                },
              })
            : [],
        ])
      : [[], []];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Глобальный поиск"
        description="Поиск по доступным вам лидам, проектам, клиентам, адресам и внутренним номерам"
      />
      <form className="relative">
        <Search className="text-muted-foreground absolute top-4 left-4 size-5" />
        <Input
          name="q"
          defaultValue={q}
          className="h-13 pl-12 text-base"
          placeholder="Введите минимум 2 символа"
          autoFocus
        />
      </form>
      {term.length > 0 && term.length < 2 ? (
        <p className="text-muted-foreground text-sm">
          Введите минимум два символа
        </p>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-2">
        {canLeads ? (
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <Megaphone className="size-5" />
              Лиды <Badge variant="outline">{leads.length}</Badge>
            </h2>
            <div className="space-y-2">
              {leads.map((l) => (
                <Link key={l.id} href={`/leads/${l.id}`}>
                  <Card>
                    <CardContent className="pt-4">
                      <b>{l.clientName || "Без имени"}</b>
                      <div className="text-primary text-sm">
                        {presentPhone(l.phone, canPhone)}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {l.districtOrAddress || "Адрес не указан"} · {l.status}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
        {canProjects ? (
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <BriefcaseBusiness className="size-5" />
              Проекты <Badge variant="outline">{projects.length}</Badge>
            </h2>
            <div className="space-y-2">
              {projects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`}>
                  <Card>
                    <CardContent className="pt-4">
                      <b>
                        {p.number} · {p.customer.name}
                      </b>
                      <div className="text-primary text-sm">
                        {presentPhone(p.customer.phone, canPhone)}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {p.address} · {p.status}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
