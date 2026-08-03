"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/modules/audit/application/write-audit";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { updateProfileSchema } from "@/modules/auth/application/schemas";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import type { ActionResult } from "@/shared/actions/action-result";
import { validationActionError } from "@/shared/actions/action-result";
import { handleActionError } from "@/shared/actions/handle-action-error";

export async function updateProfileAction(
  input: unknown,
): Promise<ActionResult<{ name: string }>> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.PROFILE_UPDATE);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: context.userId },
        data: { name: parsed.data.name },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "PROFILE_UPDATE",
          entityType: "User",
          entityId: context.userId,
          summary: "Изменено имя в профиле",
          beforeData: { name: context.name },
          afterData: { name: parsed.data.name },
        },
        tx,
      );
    });
    revalidatePath("/profile");
    return { ok: true, data: { name: parsed.data.name } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function changePasswordAction(): Promise<ActionResult<never>> {
  return {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message:
        "Самостоятельная смена пароля отключена. Обратитесь к администратору.",
    },
  };
}
