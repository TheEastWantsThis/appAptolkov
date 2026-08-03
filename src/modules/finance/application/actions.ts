"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/modules/audit/application/write-audit";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { updateProjectFinanceSchema } from "@/modules/finance/application/schemas";
import { calculateProjectFinance } from "@/modules/finance/domain/calculator";
import type { ActionResult } from "@/shared/actions/action-result";
import { validationActionError } from "@/shared/actions/action-result";
import { handleActionError } from "@/shared/actions/handle-action-error";

export async function updateProjectFinanceAction(
  input: unknown,
): Promise<ActionResult<{ version: number }>> {
  const parsed = updateProjectFinanceSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.FINANCE_MANAGE);
    const data = parsed.data;
    const calculated = calculateProjectFinance(data);
    const existing = await prisma.projectFinance.findUnique({
      where: { projectId: data.projectId },
    });
    if ((existing?.version ?? 0) !== data.version)
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message:
            "Финансы уже изменены другим пользователем. Обновите страницу.",
        },
      };

    const nextVersion = data.version + 1;
    const saved = await prisma.$transaction(async (tx) => {
      if (existing) {
        const result = await tx.projectFinance.updateMany({
          where: { projectId: data.projectId, version: data.version },
          data: {
            contractAmount: data.contractAmount,
            discountAmount: data.discountAmount,
            prepayment: data.prepayment,
            additionalPayments: data.additionalPayments,
            balanceDue: calculated.balanceDue,
            paymentMethod: data.paymentMethod,
            materialCost: data.materialCost,
            installerWages: data.installerWages,
            transportCost: data.transportCost,
            additionalExpenses: data.additionalExpenses,
            totalCost: calculated.totalCost,
            grossProfit: calculated.grossProfit,
            marginPercent: calculated.marginPercent,
            paymentDueAt: data.paymentDueAt,
            paidAt: data.paid ? (existing.paidAt ?? new Date()) : null,
            version: { increment: 1 },
            updatedById: context.userId,
          },
        });
        if (result.count !== 1) return false;
      } else {
        await tx.projectFinance.create({
          data: {
            projectId: data.projectId,
            contractAmount: data.contractAmount,
            discountAmount: data.discountAmount,
            prepayment: data.prepayment,
            additionalPayments: data.additionalPayments,
            balanceDue: calculated.balanceDue,
            paymentMethod: data.paymentMethod,
            materialCost: data.materialCost,
            installerWages: data.installerWages,
            transportCost: data.transportCost,
            additionalExpenses: data.additionalExpenses,
            totalCost: calculated.totalCost,
            grossProfit: calculated.grossProfit,
            marginPercent: calculated.marginPercent,
            paymentDueAt: data.paymentDueAt,
            paidAt: data.paid ? new Date() : null,
            version: nextVersion,
            updatedById: context.userId,
          },
        });
      }
      await writeAudit(
        {
          actorId: context.userId,
          action: "PROJECT_FINANCE_UPDATE",
          entityType: "ProjectFinance",
          entityId: data.projectId,
          summary: "Изменены финансовые данные проекта",
          beforeData: existing
            ? {
                contractAmount: existing.contractAmount,
                discountAmount: existing.discountAmount,
                balanceDue: existing.balanceDue,
                totalCost: existing.totalCost,
                grossProfit: existing.grossProfit,
                marginPercent: existing.marginPercent,
                version: existing.version,
              }
            : undefined,
          afterData: {
            contractAmount: data.contractAmount,
            discountAmount: data.discountAmount,
            prepayment: data.prepayment,
            additionalPayments: data.additionalPayments,
            balanceDue: calculated.balanceDue,
            paymentMethod: data.paymentMethod,
            materialCost: data.materialCost,
            installerWages: data.installerWages,
            transportCost: data.transportCost,
            additionalExpenses: data.additionalExpenses,
            totalCost: calculated.totalCost,
            grossProfit: calculated.grossProfit,
            marginPercent: calculated.marginPercent,
            version: nextVersion,
          },
        },
        tx,
      );
      return true;
    });
    if (!saved)
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message:
            "Финансы уже изменены другим пользователем. Обновите страницу.",
        },
      };
    revalidatePath("/finance/projects/" + data.projectId);
    revalidatePath("/projects/" + data.projectId);
    revalidatePath("/analytics");
    return { ok: true, data: { version: nextVersion } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
