import {
  BarChart3,
  Bell,
  Boxes,
  BriefcaseBusiness,
  HardHat,
  Ruler,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuthContext } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";

const links = [
  {
    href: "/analytics",
    label: "Аналитика",
    icon: BarChart3,
    permissions: [PERMISSIONS.ANALYTICS_READ, PERMISSIONS.ANALYTICS_SELF_READ],
  },
  {
    href: "/projects",
    label: "Проекты",
    icon: BriefcaseBusiness,
    permissions: [PERMISSIONS.PROJECT_READ],
  },
  {
    href: "/installations",
    label: "Монтажи",
    icon: HardHat,
    permissions: [
      PERMISSIONS.INSTALLATION_ASSIGNED_READ,
      PERMISSIONS.INSTALLATION_SCHEDULE,
    ],
  },
  {
    href: "/measurements",
    label: "Замеры",
    icon: Ruler,
    permissions: [
      PERMISSIONS.MEASUREMENT_ASSIGNED_READ,
      PERMISSIONS.PROJECT_MANAGE,
    ],
  },
  {
    href: "/notifications",
    label: "Уведомления",
    icon: Bell,
    permissions: [PERMISSIONS.NOTIFICATION_READ],
  },
  {
    href: "/inventory",
    label: "Склад",
    icon: Boxes,
    permissions: [PERMISSIONS.INVENTORY_READ],
  },
  {
    href: "/settings/tariffs",
    label: "Тарифы",
    icon: SlidersHorizontal,
    permissions: [PERMISSIONS.TARIFF_MANAGE],
  },
  {
    href: "/users",
    label: "Пользователи",
    icon: UsersRound,
    permissions: [PERMISSIONS.USER_READ],
  },
  {
    href: "/roles",
    label: "Роли",
    icon: ShieldCheck,
    permissions: [PERMISSIONS.ROLE_READ],
  },
  {
    href: "/audit",
    label: "Журнал",
    icon: ScrollText,
    permissions: [PERMISSIONS.AUDIT_READ],
  },
  {
    href: "/profile",
    label: "Профиль",
    icon: UserRound,
    permissions: [PERMISSIONS.PROFILE_READ],
  },
] as const;

export default async function MenuPage() {
  const context = await requireAuthContext();
  const visible = links.filter((link) =>
    link.permissions.some((permission) => context.permissions.has(permission)),
  );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Все разделы"
        description="Навигация по рабочему пространству"
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <Card className="h-full transition hover:border-blue-300">
                <CardContent className="flex min-h-28 flex-col items-center justify-center gap-3 pt-5 text-center font-semibold">
                  <Icon className="text-primary size-7" />
                  {link.label}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
