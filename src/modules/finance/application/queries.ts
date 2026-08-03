import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";

export async function getProjectFinance(projectId: string) {
  const context = await requirePermission(PERMISSIONS.FINANCE_READ);
  const [project, finance] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, number: true, address: true, status: true },
    }),
    prisma.projectFinance.findUnique({
      where: { projectId },
      select: {
        id: true,
        contractAmount: true,
        discountAmount: true,
        prepayment: true,
        additionalPayments: true,
        balanceDue: true,
        paymentMethod: true,
        materialCost: true,
        installerWages: true,
        transportCost: true,
        additionalExpenses: true,
        totalCost: true,
        grossProfit: true,
        marginPercent: true,
        paymentDueAt: true,
        paidAt: true,
        version: true,
        updatedAt: true,
        updatedBy: { select: { name: true } },
      },
    }),
  ]);
  return {
    project,
    finance,
    canManage: context.permissions.has(PERMISSIONS.FINANCE_MANAGE),
  };
}
