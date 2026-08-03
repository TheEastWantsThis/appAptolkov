import "server-only";

import { prisma } from "@/lib/prisma";
import {
  AuthorizationError,
  requireAuthContext,
  requirePermission,
} from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";

export async function getInstallationAccess(id: string) {
  const context = await requireAuthContext();
  const canSchedule = hasPermission(
    context.permissions,
    PERMISSIONS.INSTALLATION_SCHEDULE,
  );
  const canAssignedRead = hasPermission(
    context.permissions,
    PERMISSIONS.INSTALLATION_ASSIGNED_READ,
  );
  if (!canSchedule && !canAssignedRead) throw new AuthorizationError();

  const installation = await prisma.installation.findFirst({
    where: {
      id,
      ...(canSchedule
        ? {}
        : { participants: { some: { userId: context.userId } } }),
    },
    select: {
      id: true,
      participants: {
        where: { userId: context.userId },
        select: { userId: true },
      },
    },
  });
  if (!installation) throw new AuthorizationError();
  const assigned = installation.participants.length > 0;
  return {
    context,
    canManageProgress:
      assigned &&
      hasPermission(
        context.permissions,
        PERMISSIONS.INSTALLATION_ASSIGNED_MANAGE,
      ),
  };
}

export async function listAssignedInstallations() {
  const context = await requireAuthContext();
  const canSchedule = hasPermission(
    context.permissions,
    PERMISSIONS.INSTALLATION_SCHEDULE,
  );
  if (
    !canSchedule &&
    !hasPermission(context.permissions, PERMISSIONS.INSTALLATION_ASSIGNED_READ)
  )
    throw new AuthorizationError();

  return prisma.installation.findMany({
    where: canSchedule
      ? {}
      : { participants: { some: { userId: context.userId } } },
    orderBy: { startsAt: "asc" },
    take: 200,
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      vehicle: true,
      project: { select: { number: true, address: true } },
      participants: {
        select: {
          isForeman: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function getSafeInstallation(id: string) {
  const access = await getInstallationAccess(id);
  const installation = await prisma.installation.findUnique({
    where: { id },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      vehicle: true,
      plannedMaterials: true,
      plannedTools: true,
      technicalBrief: true,
      specialConditions: true,
      crewComment: true,
      status: true,
      actualStartedAt: true,
      actualEndedAt: true,
      workComment: true,
      issues: true,
      responsibleSignature: true,
      acceptedAt: true,
      parentInstallationId: true,
      project: {
        select: {
          number: true,
          address: true,
          rooms: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              name: true,
              area: true,
              canvasType: true,
              profileType: true,
              comment: true,
              media: {
                where: { type: "PHOTO" },
                select: { id: true, name: true, url: true },
              },
            },
          },
        },
      },
      participants: {
        orderBy: [{ isForeman: "desc" }, { assignedAt: "asc" }],
        select: {
          isForeman: true,
          user: { select: { id: true, name: true } },
        },
      },
      media: {
        orderBy: { createdAt: "asc" },
        select: { id: true, type: true, name: true, url: true },
      },
      usedMaterials: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, quantity: true, unit: true },
      },
      repeatVisits: {
        orderBy: { startsAt: "desc" },
        select: { id: true, startsAt: true, status: true },
      },
    },
  });
  return installation
    ? { ...installation, canManageProgress: access.canManageProgress }
    : null;
}

export async function listInstallationSchedulingOptions() {
  await requirePermission(PERMISSIONS.INSTALLATION_SCHEDULE);
  const [projects, installers] = await Promise.all([
    prisma.project.findMany({
      where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: { id: true, number: true, address: true },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        blockedAt: null,
        archivedAt: null,
        roles: {
          some: { role: { code: "INSTALLER", isActive: true } },
        },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { projects, installers };
}
