"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import type { ActionResult } from "@/shared/actions/action-result";
import { handleActionError } from "@/shared/actions/handle-action-error";

export async function markNotificationReadAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requirePermission(PERMISSIONS.NOTIFICATION_READ);
    const result = await prisma.notification.updateMany({
      where: { id, userId: context.userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0)
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Уведомление не найдено" },
      };
    revalidatePath("/notifications");
    return { ok: true, data: { id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function markAllNotificationsReadAction(): Promise<
  ActionResult<{ count: number }>
> {
  try {
    const context = await requirePermission(PERMISSIONS.NOTIFICATION_READ);
    const result = await prisma.notification.updateMany({
      where: { userId: context.userId, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath("/notifications");
    return { ok: true, data: { count: result.count } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
