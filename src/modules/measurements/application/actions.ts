"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/modules/audit/application/write-audit";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { createNotifications } from "@/modules/notifications/application/queries";
import { getMeasurementAccess } from "@/modules/measurements/application/queries";
import {
  saveMeasurementSchema,
  scheduleProjectMeasurementSchema,
} from "@/modules/measurements/application/schemas";
import type { ActionResult } from "@/shared/actions/action-result";
import { validationActionError } from "@/shared/actions/action-result";
import { handleActionError } from "@/shared/actions/handle-action-error";

export async function saveMeasurementAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = saveMeasurementSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const { context, canEdit } = await getMeasurementAccess(
      parsed.data.measurementId,
    );
    if (!canEdit)
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Замер доступен только назначенному замерщику",
        },
      };
    const measurement = await prisma.measurement.findUnique({
      where: { id: parsed.data.measurementId },
      select: { projectId: true, status: true },
    });
    if (!measurement)
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Замер не найден" },
      };

    await prisma.$transaction(async (tx) => {
      await tx.projectRoom.deleteMany({
        where: { measurementId: parsed.data.measurementId },
      });
      for (const [sortOrder, room] of parsed.data.rooms.entries()) {
        const { photos, drawing, ...data } = room;
        delete data.id;
        await tx.projectRoom.create({
          data: {
            ...data,
            projectId: measurement.projectId,
            measurementId: parsed.data.measurementId,
            sortOrder,
            media: {
              create: [
                ...photos.map((url, index) => ({
                  type: "PHOTO" as const,
                  name: `Фото ${index + 1}`,
                  url,
                  uploadedById: context.userId,
                })),
                ...(drawing
                  ? [
                      {
                        type: "DRAWING" as const,
                        name: "Чертёж",
                        url: drawing,
                        uploadedById: context.userId,
                      },
                    ]
                  : []),
              ],
            },
          },
        });
      }
      const completed = parsed.data.status === "COMPLETED";
      await tx.measurement.update({
        where: { id: parsed.data.measurementId },
        data: {
          status: parsed.data.status,
          startedAt:
            measurement.status === "SCHEDULED" ? new Date() : undefined,
          draftSavedAt: new Date(),
          completedAt: completed ? new Date() : null,
        },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: completed ? "MEASUREMENT_COMPLETE" : "MEASUREMENT_DRAFT_SAVE",
          entityType: "Measurement",
          entityId: parsed.data.measurementId,
          summary: completed ? "Замер завершён" : "Сохранён черновик замера",
          afterData: {
            roomCount: parsed.data.rooms.length,
            status: parsed.data.status,
          },
        },
        tx,
      );
    });
    revalidatePath("/measurements");
    revalidatePath(`/measurements/${parsed.data.measurementId}`);
    revalidatePath(`/projects/${measurement.projectId}`);
    return { ok: true, data: { id: parsed.data.measurementId } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function scheduleProjectMeasurementAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = scheduleProjectMeasurementSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.PROJECT_MANAGE);
    const measurement = await prisma.$transaction(async (tx) => {
      const created = await tx.measurement.create({ data: parsed.data });
      await tx.calendarEvent.create({
        data: {
          projectId: parsed.data.projectId,
          assigneeId: parsed.data.measurerId,
          type: "MEASUREMENT",
          title: "Замер по проекту",
          startsAt: parsed.data.scheduledAt,
          note: parsed.data.operatorComment,
        },
      });
      await tx.workTask.create({
        data: {
          projectId: parsed.data.projectId,
          assigneeId: parsed.data.measurerId,
          authorId: context.userId,
          type: "MEASUREMENT",
          title: "Провести замер",
          description: parsed.data.operatorComment,
          dueAt: parsed.data.scheduledAt,
        },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "MEASUREMENT_SCHEDULE",
          entityType: "Measurement",
          entityId: created.id,
          summary: "Назначен замер по проекту",
          afterData: {
            projectId: parsed.data.projectId,
            measurerId: parsed.data.measurerId,
            scheduledAt: parsed.data.scheduledAt,
          },
        },
        tx,
      );
      return created;
    });
    await createNotifications([
      {
        userId: parsed.data.measurerId,
        type: "ASSIGNMENT",
        title: "Назначен замер",
        body: "Новый замер в календаре",
        href: "/measurements/" + measurement.id,
        dedupeKey:
          "measurement-assignment:" +
          measurement.id +
          ":" +
          parsed.data.measurerId,
      },
    ]);
    revalidatePath("/measurements");
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return { ok: true, data: { id: measurement.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
