import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";

export async function listAuditLogs(limit = 100) {
  await requirePermission(PERMISSIONS.AUDIT_READ);
  return prisma.auditLog.findMany({
    take: Math.min(Math.max(limit, 1), 100),
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      summary: true,
      occurredAt: true,
      actor: { select: { id: true, name: true, login: true } },
    },
    orderBy: { occurredAt: "desc" },
  });
}
