"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  announcementIdSchema,
  announcementSchema,
  updateAnnouncementSchema,
} from "@/modules/announcements/application/schemas";
import {
  AuthorizationError,
  requireAuthContext,
} from "@/modules/auth/application/auth-context";
import { SYSTEM_ROLES } from "@/modules/auth/domain/roles";
import { writeAudit } from "@/modules/audit/application/write-audit";
import type { ActionResult } from "@/shared/actions/action-result";
import { validationActionError } from "@/shared/actions/action-result";
import { handleActionError } from "@/shared/actions/handle-action-error";

async function requireAnnouncementAdmin() {
  const context = await requireAuthContext();
  if (!context.roleCodes.includes(SYSTEM_ROLES.ADMIN)) {
    throw new AuthorizationError();
  }
  return context;
}

export async function createAnnouncementAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);

  try {
    const context = await requireAnnouncementAdmin();
    const announcement = await prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({
        data: { ...parsed.data, authorId: context.userId },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "ANNOUNCEMENT_CREATE",
          entityType: "Announcement",
          entityId: created.id,
          summary: "Создано объявление «" + created.title + "»",
        },
        tx,
      );
      return created;
    });
    revalidatePath("/dashboard");
    return { ok: true, data: { id: announcement.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function updateAnnouncementAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateAnnouncementSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);

  try {
    const context = await requireAnnouncementAdmin();
    await prisma.$transaction(async (tx) => {
      const previous = await tx.announcement.findUniqueOrThrow({
        where: { id: parsed.data.id },
      });
      const updated = await tx.announcement.update({
        where: { id: parsed.data.id },
        data: { title: parsed.data.title, content: parsed.data.content },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "ANNOUNCEMENT_UPDATE",
          entityType: "Announcement",
          entityId: updated.id,
          summary: "Изменено объявление «" + updated.title + "»",
          beforeData: { title: previous.title, content: previous.content },
          afterData: { title: updated.title, content: updated.content },
        },
        tx,
      );
    });
    revalidatePath("/dashboard");
    return { ok: true, data: { id: parsed.data.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function deleteAnnouncementAction(
  input: unknown,
): Promise<ActionResult<null>> {
  const parsed = announcementIdSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);

  try {
    const context = await requireAnnouncementAdmin();
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.announcement.delete({
        where: { id: parsed.data.id },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "ANNOUNCEMENT_DELETE",
          entityType: "Announcement",
          entityId: deleted.id,
          summary: "Удалено объявление «" + deleted.title + "»",
          beforeData: { title: deleted.title, content: deleted.content },
        },
        tx,
      );
    });
    revalidatePath("/dashboard");
    return { ok: true, data: null };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
