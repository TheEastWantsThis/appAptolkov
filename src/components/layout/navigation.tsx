"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpenCheck,
  Boxes,
  BriefcaseBusiness,
  Home,
  HardHat,
  Megaphone,
  Menu,
  Search,
  Ruler,
  SlidersHorizontal,
  ScrollText,
  ShieldCheck,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { cn, initials } from "@/lib/utils";
import {
  PERMISSIONS,
  type PermissionCode,
} from "@/modules/auth/domain/permissions";

interface NavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionCode;
  anyPermissions?: readonly PermissionCode[];
  mobile?: boolean;
  mobileOnly?: boolean;
  primary?: boolean;
}

const ITEMS: readonly NavigationItem[] = [
  {
    href: "/dashboard",
    label: "Главная",
    icon: Home,
    permission: PERMISSIONS.DASHBOARD_READ,
    mobile: true,
    primary: true,
  },
  {
    href: "/analytics",
    label: "Аналитика",
    icon: BarChart3,
    anyPermissions: [
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.ANALYTICS_SELF_READ,
    ],
    mobile: true,
  },
  {
    href: "/leads",
    label: "Заявки",
    icon: Megaphone,
    anyPermissions: [PERMISSIONS.LEAD_OWN_READ, PERMISSIONS.LEAD_READ],
    mobile: true,
    primary: true,
  },
  {
    href: "/projects",
    label: "Проекты",
    icon: BriefcaseBusiness,
    permission: PERMISSIONS.PROJECT_READ,
    mobile: true,
  },
  {
    href: "/menu",
    label: "Ещё",
    icon: Menu,
    permission: PERMISSIONS.DASHBOARD_READ,
    mobile: true,
    mobileOnly: true,
    primary: true,
  },
  {
    href: "/installations",
    label: "Монтажи",
    icon: HardHat,
    anyPermissions: [
      PERMISSIONS.INSTALLATION_ASSIGNED_READ,
      PERMISSIONS.INSTALLATION_SCHEDULE,
    ],
    mobile: true,
  },
  {
    href: "/measurements",
    label: "Замеры",
    icon: Ruler,
    anyPermissions: [
      PERMISSIONS.MEASUREMENT_ASSIGNED_READ,
      PERMISSIONS.PROJECT_MANAGE,
    ],
    mobile: true,
  },
  {
    href: "/notifications",
    label: "Уведомления",
    icon: Bell,
    permission: PERMISSIONS.NOTIFICATION_READ,
  },
  {
    href: "/inventory",
    label: "Склад",
    icon: Boxes,
    permission: PERMISSIONS.INVENTORY_READ,
  },
  {
    href: "/settings/tariffs",
    label: "Тарифы",
    icon: SlidersHorizontal,
    permission: PERMISSIONS.TARIFF_MANAGE,
  },
  {
    href: "/search",
    label: "Поиск",
    icon: Search,
    permission: PERMISSIONS.DASHBOARD_READ,
    mobile: true,
  },
  {
    href: "/users",
    label: "Пользователи",
    icon: UsersRound,
    permission: PERMISSIONS.USER_READ,
    mobile: true,
  },
  {
    href: "/roles",
    label: "Роли",
    icon: ShieldCheck,
    permission: PERMISSIONS.ROLE_READ,
  },
  {
    href: "/audit",
    label: "Журнал",
    icon: ScrollText,
    permission: PERMISSIONS.AUDIT_READ,
    mobile: true,
  },
  {
    href: "/profile",
    label: "Профиль",
    icon: UserRound,
    permission: PERMISSIONS.PROFILE_READ,
    mobile: true,
  },
];

function isCurrent(pathname: string, href: string) {
  return (
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(`${href}/`))
  );
}

export function DesktopSidebar({
  permissions,
  name,
  roles,
}: {
  permissions: readonly string[];
  name: string;
  roles: readonly string[];
}) {
  const pathname = usePathname();
  const visible = ITEMS.filter(
    (item) =>
      item.primary &&
      (!item.permission || permissions.includes(item.permission)) &&
      (!item.anyPermissions ||
        item.anyPermissions.some((permission) =>
          permissions.includes(permission),
        )),
  );

  return (
    <aside className="mesh-panel fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-white/10 px-4 py-5 text-white lg:flex">
      <div className="flex items-center gap-3 px-2">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-white/12 shadow-inner shadow-white/10">
          <BookOpenCheck className="size-5 text-cyan-200" />
        </div>
        <div>
          <div className="font-bold tracking-tight">Aпотолков CRM</div>
          <div className="text-xs text-blue-100/65">Рабочее пространство</div>
        </div>
      </div>

      <nav
        className="mt-9 flex flex-1 flex-col gap-1.5"
        aria-label="Основная навигация"
      >
        {visible.map((item) => {
          const active = isCurrent(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-white text-slate-950 shadow-lg shadow-slate-950/15"
                  : "text-blue-50/75 hover:bg-white/8 hover:text-white",
              )}
            >
              <Icon
                className={cn(
                  "size-4.5",
                  active ? "text-primary" : "text-blue-100/70",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-white/10 bg-white/6 p-3.5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-200 text-sm font-extrabold text-slate-900">
            {initials(name)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{name}</div>
            <div className="truncate text-[11px] text-blue-100/60">
              {roles.join(" · ")}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileBottomNavigation({
  permissions,
}: {
  permissions: readonly string[];
}) {
  const pathname = usePathname();
  const visible = ITEMS.filter(
    (item) =>
      item.mobile &&
      item.primary &&
      (!item.permission || permissions.includes(item.permission)) &&
      (!item.anyPermissions ||
        item.anyPermissions.some((permission) =>
          permissions.includes(permission),
        )),
  ).slice(0, 5);

  return (
    <nav
      className="safe-bottom bg-card/96 fixed inset-x-0 bottom-0 z-40 border-t px-2 pt-2 shadow-[0_-12px_32px_oklch(0.2_0.03_260/0.07)] backdrop-blur-xl lg:hidden"
      aria-label="Мобильная навигация"
    >
      <div className="mx-auto flex max-w-lg justify-around">
        {visible.map((item) => {
          const active = isCurrent(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-bold transition-colors",
                active ? "bg-primary/8 text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("size-5", active && "stroke-[2.5]")} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
