import "server-only";

import { prisma } from "@/lib/prisma";
import {
  AuthorizationError,
  requireAuthContext,
} from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";
import { presentPhone } from "@/modules/leads/domain/phone";

const leadStatuses = [
  "NEW",
  "IN_PROGRESS",
  "CONTACTED",
  "QUALIFIED",
  "DECLINED",
  "CONVERTED",
] as const;

export async function listLeads(filters: {
  status?: string;
  due?: "overdue" | "today" | "future";
  search?: string;
}) {
  const context = await requireAuthContext();
  const canReadAll = hasPermission(context.permissions, PERMISSIONS.LEAD_READ);
  const canReadOwn = hasPermission(
    context.permissions,
    PERMISSIONS.LEAD_OWN_READ,
  );
  if (!canReadAll && !canReadOwn) throw new AuthorizationError();

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const dueWhere =
    filters.due === "overdue"
      ? { lt: now }
      : filters.due === "today"
        ? { gte: startToday, lt: tomorrow }
        : filters.due === "future"
          ? { gte: tomorrow }
          : undefined;

  const status = leadStatuses.find((value) => value === filters.status);
  const leads = await prisma.lead.findMany({
    omit: { phoneNormalized: true },
    where: {
      ...(canReadAll ? {} : { authorId: context.userId }),
      ...(status ? { status } : {}),
      ...(filters.search
        ? {
            OR: [
              {
                clientName: {
                  contains: filters.search,
                  mode: "insensitive" as const,
                },
              },
              {
                districtOrAddress: {
                  contains: filters.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
      ...(dueWhere
        ? {
            tasks: {
              some: {
                status: { in: ["OPEN", "IN_PROGRESS"] },
                dueAt: dueWhere,
              },
            },
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    include: {
      author: { select: { name: true } },
      operator: { select: { name: true } },
      tasks: {
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        orderBy: { dueAt: "asc" },
        take: 1,
        select: { id: true, title: true, dueAt: true },
      },
    },
  });
  const canReadPhone = hasPermission(
    context.permissions,
    PERMISSIONS.CUSTOMER_PHONE_READ,
  );
  return leads.map(({ phone, ...lead }) => ({
    ...lead,
    phone: presentPhone(phone, canReadPhone),
  }));
}

export async function getLead(id: string) {
  const context = await requireAuthContext();
  const canReadAll = hasPermission(context.permissions, PERMISSIONS.LEAD_READ);
  const canReadOwn = hasPermission(
    context.permissions,
    PERMISSIONS.LEAD_OWN_READ,
  );
  if (!canReadAll && !canReadOwn) throw new AuthorizationError();

  const lead = await prisma.lead.findFirst({
    omit: { phoneNormalized: true },
    where: { id, ...(canReadAll ? {} : { authorId: context.userId }) },
    include: {
      author: { select: { name: true } },
      operator: { select: { name: true } },
      measurer: { select: { name: true } },
      calls: {
        orderBy: { calledAt: "desc" },
        include: { author: { select: { name: true } } },
      },
      tasks: {
        orderBy: [{ status: "asc" }, { dueAt: "asc" }],
        include: { assignee: { select: { name: true } } },
      },
      project: { select: { id: true, number: true } },
    },
  });
  if (!lead) return null;
  const canReadPhone = hasPermission(
    context.permissions,
    PERMISSIONS.CUSTOMER_PHONE_READ,
  );
  const { phone, ...safeLead } = lead;
  return {
    ...safeLead,
    phone: presentPhone(phone, canReadPhone),
    canReadPhone,
  };
}

export async function listMeasurers() {
  await requireAuthContext();
  return prisma.user.findMany({
    where: {
      isActive: true,
      blockedAt: null,
      roles: { some: { role: { code: "MEASURER", isActive: true } } },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
