import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";

export async function listUsers() {
  await requirePermission(PERMISSIONS.USER_READ);
  return prisma.user.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      login: true,
      isActive: true,
      blockedAt: true,
      lastLoginAt: true,
      createdAt: true,
      roles: {
        select: { role: { select: { id: true, code: true, name: true } } },
        orderBy: { role: { name: "asc" } },
      },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function getUserForEdit(id: string) {
  await requirePermission(PERMISSIONS.USER_READ);
  return prisma.user.findFirst({
    where: { id, archivedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      login: true,
      isActive: true,
      blockedAt: true,
      blockedReason: true,
      roles: { select: { roleId: true } },
    },
  });
}

export async function listAssignableRoles() {
  await requirePermission(PERMISSIONS.USER_READ);
  return prisma.role.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, description: true },
    orderBy: { name: "asc" },
  });
}
