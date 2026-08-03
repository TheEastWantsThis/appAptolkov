"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/modules/audit/application/write-audit";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { getInstallationAccess } from "@/modules/installations/application/queries";
import {
  repeatInstallationSchema,
  scheduleInstallationSchema,
  updateInstallationProgressSchema,
} from "@/modules/installations/application/schemas";
import {
  canTransitionInstallation,
  type InstallationStatusValue,
  validateInstallationCompletion,
} from "@/modules/installations/domain/state-machine";
import type { ActionResult } from "@/shared/actions/action-result";
import { validationActionError } from "@/shared/actions/action-result";
import { handleActionError } from "@/shared/actions/handle-action-error";

async function findConflicts(
  userIds: readonly string[],
  startsAt: Date,
  endsAt: Date,
  excludeId?: string,
) {
  return prisma.installation.findMany({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      participants: { some: { userId: { in: [...userIds] } } },
    },
    select: {
      startsAt: true,
      endsAt: true,
      participants: {
        where: { userId: { in: [...userIds] } },
        select: { user: { select: { name: true } } },
      },
    },
    take: 20,
  });
}

function conflictMessage(conflicts: Awaited<ReturnType<typeof findConflicts>>) {
  const names = [
    ...new Set(
      conflicts.flatMap((item) =>
        item.participants.map(({ user }) => user.name),
      ),
    ),
  ];
  return (
    "Пересечение календаря: " +
    names.join(", ") +
    ". Проверьте время или подтвердите назначение несмотря на пересечение."
  );
}

export async function scheduleInstallationAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = scheduleInstallationSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.INSTALLATION_SCHEDULE);
    const data = parsed.data;
    const installerIds = [...new Set(data.installerIds)];
    const endsAt = new Date(
      data.startsAt.getTime() + data.durationMinutes * 60_000,
    );
    const validInstallers = await prisma.user.findMany({
      where: {
        id: { in: installerIds },
        isActive: true,
        blockedAt: null,
        archivedAt: null,
        roles: { some: { role: { code: "INSTALLER", isActive: true } } },
      },
      select: { id: true },
    });
    if (validInstallers.length !== installerIds.length)
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Один из выбранных монтажников недоступен",
        },
      };

    const conflicts = await findConflicts(installerIds, data.startsAt, endsAt);
    if (conflicts.length && !data.allowConflicts)
      return {
        ok: false,
        error: { code: "CONFLICT", message: conflictMessage(conflicts) },
      };

    const installation = await prisma.$transaction(async (tx) => {
      const created = await tx.installation.create({
        data: {
          projectId: data.projectId,
          startsAt: data.startsAt,
          endsAt,
          vehicle: data.vehicle,
          schedulerComment: data.schedulerComment,
          plannedMaterials: data.plannedMaterials,
          plannedTools: data.plannedTools,
          technicalBrief: data.technicalBrief,
          specialConditions: data.specialConditions,
          crewComment: data.crewComment,
          participants: {
            create: installerIds.map((userId) => ({
              userId,
              isForeman: userId === data.foremanId,
            })),
          },
        },
      });
      await tx.calendarEvent.createMany({
        data: installerIds.map((assigneeId) => ({
          projectId: data.projectId,
          installationId: created.id,
          assigneeId,
          type: "INSTALLATION" as const,
          title: "Монтаж",
          startsAt: data.startsAt,
          endsAt,
          note: data.crewComment,
        })),
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "INSTALLATION_SCHEDULE",
          entityType: "Installation",
          entityId: created.id,
          summary: "Назначен монтаж по проекту",
          afterData: {
            projectId: data.projectId,
            startsAt: data.startsAt,
            endsAt,
            installerIds,
            foremanId: data.foremanId,
            conflictsConfirmed: conflicts.length > 0,
          },
        },
        tx,
      );
      return created;
    });
    revalidatePath("/installations");
    revalidatePath("/projects/" + data.projectId);
    return { ok: true, data: { id: installation.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function updateInstallationProgressAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateInstallationProgressSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const access = await getInstallationAccess(parsed.data.installationId);
    if (!access.canManageProgress)
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Изменять ход монтажа может только назначенный монтажник",
        },
      };

    const current = await prisma.installation.findUnique({
      where: { id: parsed.data.installationId },
      select: {
        status: true,
        actualStartedAt: true,
        projectId: true,
      },
    });
    if (!current)
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Монтаж не найден" },
      };
    if (
      !canTransitionInstallation(
        current.status as InstallationStatusValue,
        parsed.data.status,
      )
    )
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Недопустимый переход статуса монтажа",
        },
      };

    const actualStartedAt =
      parsed.data.actualStartedAt ??
      current.actualStartedAt ??
      (parsed.data.status === "STARTED" ? new Date() : null);
    if (parsed.data.status === "COMPLETED") {
      const missing = validateInstallationCompletion({
        actualStartedAt,
        afterPhotos: parsed.data.afterPhotos,
        responsibleSignature: parsed.data.responsibleSignature ?? null,
        accepted: parsed.data.accepted,
      });
      if (missing.length)
        return {
          ok: false,
          error: {
            code: "VALIDATION",
            message: "Для завершения заполните: " + missing.join(", "),
          },
        };
    }

    await prisma.$transaction(async (tx) => {
      await tx.installationMedia.deleteMany({
        where: { installationId: parsed.data.installationId },
      });
      await tx.installationMaterialUsage.deleteMany({
        where: { installationId: parsed.data.installationId },
      });
      await tx.installation.update({
        where: { id: parsed.data.installationId },
        data: {
          status: parsed.data.status,
          actualStartedAt,
          actualEndedAt:
            parsed.data.actualEndedAt ??
            (parsed.data.status === "COMPLETED" ? new Date() : null),
          workComment: parsed.data.workComment,
          issues: parsed.data.issues,
          responsibleSignature: parsed.data.responsibleSignature,
          acceptedAt: parsed.data.accepted ? new Date() : null,
          media: {
            create: [
              ...parsed.data.beforePhotos.map((url, index) => ({
                type: "BEFORE" as const,
                name: "До монтажа " + (index + 1),
                url,
                uploadedById: access.context.userId,
              })),
              ...parsed.data.processPhotos.map((url, index) => ({
                type: "PROCESS" as const,
                name: "В процессе " + (index + 1),
                url,
                uploadedById: access.context.userId,
              })),
              ...parsed.data.afterPhotos.map((url, index) => ({
                type: "AFTER" as const,
                name: "После монтажа " + (index + 1),
                url,
                uploadedById: access.context.userId,
              })),
            ],
          },
          usedMaterials: { create: parsed.data.usedMaterials },
        },
      });
      await writeAudit(
        {
          actorId: access.context.userId,
          action: "INSTALLATION_PROGRESS_UPDATE",
          entityType: "Installation",
          entityId: parsed.data.installationId,
          summary: "Обновлён ход монтажа",
          beforeData: { status: current.status },
          afterData: {
            status: parsed.data.status,
            accepted: parsed.data.accepted,
            mediaCount:
              parsed.data.beforePhotos.length +
              parsed.data.processPhotos.length +
              parsed.data.afterPhotos.length,
            usedMaterialCount: parsed.data.usedMaterials.length,
          },
        },
        tx,
      );
    });
    revalidatePath("/installations");
    revalidatePath("/installations/" + parsed.data.installationId);
    revalidatePath("/projects/" + current.projectId);
    return { ok: true, data: { id: parsed.data.installationId } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function createRepeatInstallationAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = repeatInstallationSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const access = await getInstallationAccess(parsed.data.installationId);
    if (!access.canManageProgress)
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Повторный выезд создаёт назначенный участник бригады",
        },
      };
    const source = await prisma.installation.findUnique({
      where: { id: parsed.data.installationId },
      include: { participants: true },
    });
    if (!source)
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Монтаж не найден" },
      };
    const endsAt = new Date(
      parsed.data.startsAt.getTime() + parsed.data.durationMinutes * 60_000,
    );
    const userIds = source.participants.map(({ userId }) => userId);
    const conflicts = await findConflicts(
      userIds,
      parsed.data.startsAt,
      endsAt,
      source.id,
    );
    if (conflicts.length && !parsed.data.allowConflicts)
      return {
        ok: false,
        error: { code: "CONFLICT", message: conflictMessage(conflicts) },
      };

    const repeat = await prisma.$transaction(async (tx) => {
      await tx.installation.update({
        where: { id: source.id },
        data: { status: "REPEAT_REQUIRED" },
      });
      const created = await tx.installation.create({
        data: {
          projectId: source.projectId,
          startsAt: parsed.data.startsAt,
          endsAt,
          vehicle: source.vehicle,
          schedulerComment: "Повторный выезд",
          plannedMaterials: source.plannedMaterials,
          plannedTools: source.plannedTools,
          technicalBrief: source.technicalBrief,
          specialConditions: source.specialConditions,
          crewComment: source.crewComment,
          parentInstallationId: source.id,
          participants: {
            create: source.participants.map(({ userId, isForeman }) => ({
              userId,
              isForeman,
            })),
          },
        },
      });
      await tx.calendarEvent.createMany({
        data: userIds.map((assigneeId) => ({
          projectId: source.projectId,
          installationId: created.id,
          assigneeId,
          type: "INSTALLATION" as const,
          title: "Повторный монтаж",
          startsAt: parsed.data.startsAt,
          endsAt,
          note: source.crewComment,
        })),
      });
      await writeAudit(
        {
          actorId: access.context.userId,
          action: "INSTALLATION_REPEAT_CREATE",
          entityType: "Installation",
          entityId: created.id,
          summary: "Создан повторный выезд",
          afterData: {
            parentInstallationId: source.id,
            startsAt: parsed.data.startsAt,
            conflictsConfirmed: conflicts.length > 0,
          },
        },
        tx,
      );
      return created;
    });
    revalidatePath("/installations");
    revalidatePath("/installations/" + source.id);
    revalidatePath("/projects/" + source.projectId);
    return { ok: true, data: { id: repeat.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
