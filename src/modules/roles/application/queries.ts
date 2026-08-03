import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";

export async function listRolesWithPermissions() {
  await requirePermission(PERMISSIONS.ROLE_READ);
  return prisma.role.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      _count: { select: { users: true } },
      permissions: {
        select: {
          permission: {
            select: { id: true, code: true, name: true, category: true },
          },
        },
        orderBy: { permission: { category: "asc" } },
      },
    },
    orderBy: { name: "asc" },
  });
}
