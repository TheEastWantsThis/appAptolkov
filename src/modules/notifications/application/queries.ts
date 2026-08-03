import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";

interface NotificationInput {
  userId: string;
  type:
    | "NEW_LEAD"
    | "OVERDUE_CALL"
    | "MEASUREMENT_TOMORROW"
    | "INSTALLATION_TOMORROW"
    | "ASSIGNMENT"
    | "STATUS_CHANGED"
    | "MATERIAL_SHORTAGE"
    | "PAYMENT_OVERDUE"
    | "REPEAT_VISIT";
  title: string;
  body: string;
  href?: string;
  dedupeKey: string;
}

export async function createNotifications(items: readonly NotificationInput[]) {
  if (items.length === 0) return;
  await prisma.notification.createMany({
    data: items.map((item) => ({ ...item })),
    skipDuplicates: true,
  });
}

export async function notifyRoles(
  roleCodes: readonly string[],
  input: Omit<NotificationInput, "userId" | "dedupeKey"> & {
    dedupeKeyPrefix: string;
  },
) {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      blockedAt: null,
      archivedAt: null,
      roles: { some: { role: { code: { in: [...roleCodes] } } } },
    },
    select: { id: true },
  });
  await createNotifications(
    users.map(({ id }) => ({
      userId: id,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      dedupeKey: input.dedupeKeyPrefix + ":" + id,
    })),
  );
}

async function syncScheduledNotifications(
  userId: string,
  permissions: ReadonlySet<string>,
) {
  const now = new Date();
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const [tasks, measurements, installations] = await Promise.all([
    prisma.workTask.findMany({
      where: {
        assigneeId: userId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        dueAt: { lt: now },
        type: { in: ["CALL", "FOLLOW_UP"] },
      },
      select: { id: true, title: true, leadId: true },
      take: 100,
    }),
    prisma.measurement.findMany({
      where: {
        measurerId: userId,
        scheduledAt: { gte: tomorrowStart, lt: tomorrowEnd },
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        scheduledAt: true,
        project: { select: { number: true } },
      },
      take: 100,
    }),
    prisma.installation.findMany({
      where: {
        participants: { some: { userId } },
        startsAt: { gte: tomorrowStart, lt: tomorrowEnd },
        status: { not: "COMPLETED" },
      },
      select: {
        id: true,
        startsAt: true,
        project: { select: { number: true } },
      },
      take: 100,
    }),
  ]);

  const items: NotificationInput[] = [
    ...tasks.map((task) => ({
      userId,
      type: "OVERDUE_CALL" as const,
      title: "Просрочен звонок",
      body: task.title,
      href: task.leadId ? "/leads/" + task.leadId : "/leads",
      dedupeKey: "overdue-call:" + task.id,
    })),
    ...measurements.map((measurement) => ({
      userId,
      type: "MEASUREMENT_TOMORROW" as const,
      title: "Замер завтра",
      body: "Проект " + measurement.project.number,
      href: "/measurements/" + measurement.id,
      dedupeKey: "measurement-tomorrow:" + measurement.id + ":" + userId,
    })),
    ...installations.map((installation) => ({
      userId,
      type: "INSTALLATION_TOMORROW" as const,
      title: "Монтаж завтра",
      body: "Проект " + installation.project.number,
      href: "/installations/" + installation.id,
      dedupeKey: "installation-tomorrow:" + installation.id + ":" + userId,
    })),
  ];

  if (hasPermission(permissions, PERMISSIONS.FINANCE_READ)) {
    const overdue = await prisma.projectFinance.findMany({
      where: { paymentDueAt: { lt: now }, paidAt: null, balanceDue: { gt: 0 } },
      select: {
        projectId: true,
        balanceDue: true,
        project: { select: { number: true } },
      },
      take: 100,
    });
    items.push(
      ...overdue.map((finance) => ({
        userId,
        type: "PAYMENT_OVERDUE" as const,
        title: "Просрочена оплата",
        body:
          "Проект " +
          finance.project.number +
          " · остаток " +
          Number(finance.balanceDue).toLocaleString("ru-RU") +
          " ₽",
        href: "/finance/projects/" + finance.projectId,
        dedupeKey: "payment-overdue:" + finance.projectId + ":" + userId,
      })),
    );
  }

  if (hasPermission(permissions, PERMISSIONS.INVENTORY_READ)) {
    const shortages = await prisma.inventoryItem.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        quantity: true,
        reserved: true,
        minimumQuantity: true,
        version: true,
      },
    });
    items.push(
      ...shortages
        .filter(
          (item) =>
            Number(item.quantity) - Number(item.reserved) <
            Number(item.minimumQuantity),
        )
        .map((item) => ({
          userId,
          type: "MATERIAL_SHORTAGE" as const,
          title: "Нехватка материала",
          body: item.name,
          href: "/inventory",
          dedupeKey:
            "material-shortage:" + item.id + ":" + item.version + ":" + userId,
        })),
    );
  }
  await createNotifications(items);
}

export async function listNotifications() {
  const context = await requirePermission(PERMISSIONS.NOTIFICATION_READ);
  await syncScheduledNotifications(context.userId, context.permissions);
  return prisma.notification.findMany({
    where: { userId: context.userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });
}
