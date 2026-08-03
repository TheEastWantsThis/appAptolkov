import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Clock3,
  KeyRound,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { requirePagePermission } from "@/modules/auth/application/page-access";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";

export const metadata: Metadata = { title: "Главная панель" };

export default async function DashboardPage() {
  const context = await requirePagePermission(PERMISSIONS.DASHBOARD_READ);
  const canReadUsers = hasPermission(
    context.permissions,
    PERMISSIONS.USER_READ,
  );
  const canReadAudit = hasPermission(
    context.permissions,
    PERMISSIONS.AUDIT_READ,
  );

  const [userCount, blockedCount, recentAudit] = await Promise.all([
    canReadUsers
      ? prisma.user.count({ where: { archivedAt: null } })
      : Promise.resolve(null),
    canReadUsers
      ? prisma.user.count({
          where: {
            archivedAt: null,
            OR: [{ isActive: false }, { blockedAt: { not: null } }],
          },
        })
      : Promise.resolve(null),
    canReadAudit
      ? prisma.auditLog.findMany({
          take: 4,
          orderBy: { occurredAt: "desc" },
          select: {
            id: true,
            summary: true,
            occurredAt: true,
            actor: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-7">
      <PageHeader
        title={`Здравствуйте, ${context.name.split(" ")[0] ?? context.name}`}
        description="Каркас управления доступом работает. Следующие бизнес-модули будут подключаться к тем же серверным политикам."
        action={<Badge variant="success">Система доступна</Badge>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-primary text-primary-foreground overflow-hidden border-0 sm:col-span-2">
          <CardHeader>
            <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-white/14">
              <Sparkles className="size-5" />
            </div>
            <CardTitle className="text-2xl">Основа CRM готова</CardTitle>
            <CardDescription className="max-w-md text-blue-100/75">
              Авторизация, роли, серверный RBAC и аудит уже образуют защищённый
              фундамент для лидов, замеров и монтажа.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              variant="secondary"
              className="text-primary bg-white hover:bg-blue-50"
            >
              <Link href="/profile">
                Проверить профиль <ArrowUpRight />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="bg-secondary text-primary flex size-10 items-center justify-center rounded-xl">
                <UsersRound />
              </div>
              {canReadUsers ? (
                <Badge variant="outline">Доступ разрешён</Badge>
              ) : null}
            </div>
            <CardDescription>Пользователи</CardDescription>
            <CardTitle className="text-3xl">{userCount ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {blockedCount === null
              ? "Скрыто вашей ролью"
              : `Заблокировано: ${blockedCount}`}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <ShieldCheck />
            </div>
            <CardDescription>Ваши роли</CardDescription>
            <CardTitle className="text-lg leading-snug">
              {context.roleCodes.join(", ")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Эффективных разрешений: {context.permissions.size}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Последние действия</CardTitle>
              <CardDescription>
                Важные изменения защищённого контура
              </CardDescription>
            </div>
            {canReadAudit ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/audit">
                  Весь журнал <ArrowUpRight />
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {recentAudit.length > 0 ? (
              <div className="divide-y">
                {recentAudit.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
                      <Clock3 className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">
                        {entry.summary}
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        {entry.actor?.name ?? "Система"} ·{" "}
                        {formatDateTime(entry.occurredAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {canReadAudit
                  ? "Записей пока нет"
                  : "Журнал доступен только пользователям с разрешением audit.read"}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <KeyRound />
            </div>
            <CardTitle>Безопасность</CardTitle>
            <CardDescription>
              Сессия проверяется по актуальному состоянию пользователя и
              permissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-semibold">{context.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Логин</span>
              <span className="font-semibold">{context.login}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Пароль</span>
              <Badge
                variant={context.mustChangePassword ? "destructive" : "success"}
              >
                {context.mustChangePassword ? "Нужно сменить" : "Актуален"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
