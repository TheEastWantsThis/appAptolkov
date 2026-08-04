import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList, Plus } from "lucide-react";

import { AnnouncementBoard } from "@/components/announcements/announcement-board";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/modules/auth/application/page-access";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";
import { SYSTEM_ROLES } from "@/modules/auth/domain/roles";
import { listAnnouncements } from "@/modules/announcements/application/queries";

export const metadata: Metadata = { title: "Главная" };

export default async function DashboardPage() {
  const context = await requirePagePermission(PERMISSIONS.DASHBOARD_READ);
  const firstName = context.name.trim().split(/\s+/)[0] ?? context.name;
  const canReadApplications =
    hasPermission(context.permissions, PERMISSIONS.LEAD_READ) ||
    hasPermission(context.permissions, PERMISSIONS.LEAD_OWN_READ);
  const canCreateApplication = hasPermission(
    context.permissions,
    PERMISSIONS.LEAD_CREATE,
  );
  const announcements = await listAnnouncements();
  const canManageAnnouncements = context.roleCodes.includes(SYSTEM_ROLES.ADMIN);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <p className="text-muted-foreground text-sm font-medium">Главная</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Здравствуйте, {firstName}
        </h1>
      </header>

      <AnnouncementBoard
        announcements={announcements}
        canManage={canManageAnnouncements}
      />

      <section aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" className="mb-3 text-lg font-bold">
          Заявки
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {canReadApplications ? (
            <Button
              asChild
              variant="outline"
              className="h-auto min-h-24 justify-between rounded-2xl px-5 py-4 text-base shadow-sm"
            >
              <Link href="/leads">
                <span className="flex items-center gap-3">
                  <span className="bg-secondary text-primary flex size-10 items-center justify-center rounded-xl">
                    <ClipboardList className="size-5" />
                  </span>
                  Перейти к заявкам
                </span>
                <ArrowRight className="size-5" />
              </Link>
            </Button>
          ) : null}

          {canCreateApplication ? (
            <Button
              asChild
              className="h-auto min-h-24 justify-between rounded-2xl px-5 py-4 text-base shadow-sm"
            >
              <Link href="/leads/new">
                <span className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-white/15">
                    <Plus className="size-5" />
                  </span>
                  Добавить заявку
                </span>
                <ArrowRight className="size-5" />
              </Link>
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
