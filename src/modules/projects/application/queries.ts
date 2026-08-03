import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";
import { presentPhone } from "@/modules/leads/domain/phone";

const statuses = [
  "QUALIFIED",
  "MEASUREMENT_SCHEDULED",
  "MEASURED",
  "ESTIMATE_PREPARATION",
  "CONTRACT_PENDING",
  "CONTRACT_SIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export async function listProjects(filters: {
  search?: string;
  status?: string;
  sort?: "updated" | "created" | "number";
}) {
  const context = await requirePermission(PERMISSIONS.PROJECT_READ);
  const status = statuses.find((value) => value === filters.status);
  const projects = await prisma.project.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(filters.search
        ? {
            OR: [
              {
                number: {
                  contains: filters.search,
                  mode: "insensitive" as const,
                },
              },
              {
                address: {
                  contains: filters.search,
                  mode: "insensitive" as const,
                },
              },
              {
                customer: {
                  name: {
                    contains: filters.search,
                    mode: "insensitive" as const,
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy:
      filters.sort === "number"
        ? { number: "asc" }
        : filters.sort === "created"
          ? { createdAt: "desc" }
          : { updatedAt: "desc" },
    take: 200,
    include: {
      customer: { select: { name: true, phone: true } },
      responsibles: { include: { user: { select: { name: true } } } },
      tasks: {
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        select: { dueAt: true },
      },
      _count: { select: { rooms: true, tasks: true } },
    },
  });
  const canReadPhone = hasPermission(
    context.permissions,
    PERMISSIONS.CUSTOMER_PHONE_READ,
  );
  return projects.map(({ customer, ...project }) => ({
    ...project,
    customer: {
      name: customer.name,
      phone: presentPhone(customer.phone, canReadPhone),
    },
    hasOverdueTasks: project.tasks.some(
      ({ dueAt }) => dueAt && dueAt < new Date(),
    ),
  }));
}

export async function getProject(id: string) {
  const context = await requirePermission(PERMISSIONS.PROJECT_READ);
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      customer: { omit: { phoneNormalized: true } },
      lead: { select: { id: true, source: true } },
      responsibles: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { assignedAt: "desc" },
      },
      tasks: {
        include: {
          assignee: { select: { name: true } },
          author: { select: { name: true } },
        },
        orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      },
      comments: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      files: {
        include: { uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      statusHistory: {
        include: { changedBy: { select: { name: true } } },
        orderBy: { changedAt: "desc" },
      },
      assignmentHistory: {
        include: {
          user: { select: { name: true } },
          changedBy: { select: { name: true } },
        },
        orderBy: { changedAt: "desc" },
      },
      events: {
        include: { assignee: { select: { name: true } } },
        orderBy: { startsAt: "desc" },
      },
      rooms: { orderBy: { sortOrder: "asc" } },
      measurements: {
        orderBy: { scheduledAt: "desc" },
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          measurer: { select: { name: true } },
        },
      },
      estimates: {
        orderBy: { version: "desc" },
        select: { id: true, version: true, status: true, createdAt: true },
      },
    },
  });
  if (!project) return null;
  const canReadPhone = hasPermission(
    context.permissions,
    PERMISSIONS.CUSTOMER_PHONE_READ,
  );
  const { customer, ...safeProject } = project;
  const { phone, ...safeCustomer } = customer;
  return {
    ...safeProject,
    customer: { ...safeCustomer, phone: presentPhone(phone, canReadPhone) },
    canReadPhone,
    canManage: hasPermission(context.permissions, PERMISSIONS.PROJECT_MANAGE),
    canReadFinance: hasPermission(
      context.permissions,
      PERMISSIONS.FINANCE_READ,
    ),
    canScheduleInstallation: hasPermission(
      context.permissions,
      PERMISSIONS.INSTALLATION_SCHEDULE,
    ),
  };
}

export async function listAssignableUsers() {
  await requirePermission(PERMISSIONS.PROJECT_MANAGE);
  return prisma.user.findMany({
    where: { isActive: true, blockedAt: null, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
