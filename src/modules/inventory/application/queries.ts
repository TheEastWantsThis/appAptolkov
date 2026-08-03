import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";

export async function listInventory() {
  const context = await requirePermission(PERMISSIONS.INVENTORY_READ);
  const items = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      movements: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { actor: { select: { name: true } } },
      },
    },
  });
  return {
    items,
    canManage: context.permissions.has(PERMISSIONS.INVENTORY_MANAGE),
  };
}
