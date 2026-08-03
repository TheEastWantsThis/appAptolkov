import "server-only";

import { prisma } from "@/lib/prisma";
import {
  AuthorizationError,
  requireAuthContext,
} from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";

export async function getMeasurementAccess(measurementId: string) {
  const context = await requireAuthContext();
  const canManageProjects = hasPermission(
    context.permissions,
    PERMISSIONS.PROJECT_MANAGE,
  );
  const canAssignedRead = hasPermission(
    context.permissions,
    PERMISSIONS.MEASUREMENT_ASSIGNED_READ,
  );
  if (!canManageProjects && !canAssignedRead) throw new AuthorizationError();
  const measurement = await prisma.measurement.findFirst({
    where: {
      id: measurementId,
      ...(canManageProjects ? {} : { measurerId: context.userId }),
    },
    select: { id: true, measurerId: true },
  });
  if (!measurement) throw new AuthorizationError();
  return {
    context,
    canEdit:
      canManageProjects ||
      (measurement.measurerId === context.userId &&
        hasPermission(
          context.permissions,
          PERMISSIONS.MEASUREMENT_ASSIGNED_MANAGE,
        )),
  };
}

export async function listAssignedMeasurements() {
  const context = await requireAuthContext();
  const canManageProjects = hasPermission(
    context.permissions,
    PERMISSIONS.PROJECT_MANAGE,
  );
  if (
    !canManageProjects &&
    !hasPermission(context.permissions, PERMISSIONS.MEASUREMENT_ASSIGNED_READ)
  )
    throw new AuthorizationError();
  return prisma.measurement.findMany({
    where: canManageProjects ? {} : { measurerId: context.userId },
    orderBy: { scheduledAt: "asc" },
    take: 200,
    include: {
      project: {
        select: {
          number: true,
          address: true,
          customer: { select: { name: true } },
        },
      },
      measurer: { select: { name: true } },
      _count: { select: { rooms: true } },
    },
  });
}

export async function getMeasurement(id: string) {
  const access = await getMeasurementAccess(id);
  const measurement = await prisma.measurement.findUnique({
    where: { id },
    include: {
      project: {
        select: {
          id: true,
          number: true,
          address: true,
          customer: { select: { name: true } },
        },
      },
      measurer: { select: { name: true } },
      rooms: {
        orderBy: { sortOrder: "asc" },
        include: { media: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  return measurement ? { ...measurement, canEdit: access.canEdit } : null;
}
