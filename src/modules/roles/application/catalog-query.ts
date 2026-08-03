import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";

export async function listPermissionCatalog() {
  await requirePermission(PERMISSIONS.ROLE_READ);
  return prisma.permission.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      category: true,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}
