import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface AuditInput {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  beforeData?: Prisma.InputJsonValue;
  afterData?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

export async function writeAudit(
  input: AuditInput,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;
  return client.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      beforeData: input.beforeData,
      afterData: input.afterData,
      metadata: input.metadata,
    },
  });
}
