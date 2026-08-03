import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";

export async function getEstimate(id: string) {
  const context = await requirePermission(PERMISSIONS.ESTIMATE_READ);
  const estimate = await prisma.estimate.findUnique({
    where: { id },
    select: {
      id: true,
      version: true,
      status: true,
      discountPercent: true,
      subtotalInternal: true,
      subtotalClient: true,
      discountAmount: true,
      totalInternal: true,
      totalClient: true,
      createdAt: true,
      finalizedAt: true,
      author: { select: { name: true } },
      project: {
        select: {
          id: true,
          number: true,
          address: true,
          customer: { select: { name: true } },
        },
      },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!estimate) return null;
  const canClient = hasPermission(
    context.permissions,
    PERMISSIONS.ESTIMATE_CLIENT_PRICE_READ,
  );
  const canInternal = hasPermission(
    context.permissions,
    PERMISSIONS.ESTIMATE_INTERNAL_PRICE_READ,
  );
  return {
    id: estimate.id,
    version: estimate.version,
    status: estimate.status,
    discountPercent: canClient ? Number(estimate.discountPercent) : null,
    subtotalClient: canClient ? Number(estimate.subtotalClient) : null,
    discountAmount: canClient ? Number(estimate.discountAmount) : null,
    totalClient: canClient ? Number(estimate.totalClient) : null,
    subtotalInternal: canInternal ? Number(estimate.subtotalInternal) : null,
    totalInternal: canInternal ? Number(estimate.totalInternal) : null,
    createdAt: estimate.createdAt,
    finalizedAt: estimate.finalizedAt,
    author: estimate.author,
    project: estimate.project,
    canClient,
    canInternal,
    lines: estimate.lines.map((line) => ({
      id: line.id,
      code: line.code,
      description: line.description,
      quantity: Number(line.quantity),
      unit: line.unit,
      clientUnitPrice: canClient ? Number(line.clientUnitPrice) : null,
      clientAmount: canClient ? Number(line.clientAmount) : null,
      internalUnitPrice: canInternal ? Number(line.internalUnitPrice) : null,
      internalAmount: canInternal ? Number(line.internalAmount) : null,
    })),
  };
}

export async function listProjectEstimates(projectId: string) {
  const context = await requirePermission(PERMISSIONS.ESTIMATE_READ);
  const canClient = hasPermission(
    context.permissions,
    PERMISSIONS.ESTIMATE_CLIENT_PRICE_READ,
  );
  const canInternal = hasPermission(
    context.permissions,
    PERMISSIONS.ESTIMATE_INTERNAL_PRICE_READ,
  );
  const estimates = await prisma.estimate.findMany({
    where: { projectId },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      status: true,
      totalClient: true,
      totalInternal: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });
  return estimates.map((estimate) => ({
    ...estimate,
    totalClient: canClient ? Number(estimate.totalClient) : null,
    totalInternal: canInternal ? Number(estimate.totalInternal) : null,
  }));
}

export async function listTariffs() {
  await requirePermission(PERMISSIONS.TARIFF_MANAGE);
  return prisma.tariff.findMany({
    orderBy: [{ category: "asc" }, { code: "asc" }],
  });
}
