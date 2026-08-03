"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/modules/audit/application/write-audit";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { createNotifications } from "@/modules/notifications/application/queries";
import {
  assignmentSchema,
  projectCommentSchema,
  projectEventSchema,
  projectFileSchema,
  projectRoomSchema,
  projectStatusSchema,
  projectTaskSchema,
  taskStatusSchema,
} from "@/modules/projects/application/schemas";
import {
  validateProjectTransition,
  type ProjectStatusCode,
} from "@/modules/projects/domain/state-machine";
import type { ActionResult } from "@/shared/actions/action-result";
import { validationActionError } from "@/shared/actions/action-result";
import { handleActionError } from "@/shared/actions/handle-action-error";

export async function changeProjectStatusAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = projectStatusSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.PROJECT_MANAGE);
    const project = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
      include: {
        _count: {
          select: {
            rooms: true,
            responsibles: true,
            tasks: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } } },
            installations: { where: { status: { not: "COMPLETED" } } },
          },
        },
        finance: { select: { balanceDue: true, paidAt: true } },
        events: {
          where: { type: "MEASUREMENT" },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!project)
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Проект не найден" },
      };
    const message = validateProjectTransition(
      project.status as ProjectStatusCode,
      parsed.data.status,
      {
        hasAddress: project.address.trim().length > 0,
        hasMeasurementEvent: project.events.length > 0,
        hasResponsible: project._count.responsibles > 0,
        roomCount: project._count.rooms,
        openTaskCount: project._count.tasks,
        incompleteInstallationCount: project._count.installations,
        hasFinancialSettlement:
          Boolean(project.finance?.paidAt) &&
          Number(project.finance?.balanceDue ?? 0) === 0,
      },
    );
    if (message) return { ok: false, error: { code: "CONFLICT", message } };

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: project.id },
        data: { status: parsed.data.status },
      });
      await tx.projectStatusHistory.create({
        data: {
          projectId: project.id,
          fromStatus: project.status,
          toStatus: parsed.data.status,
          changedById: context.userId,
          comment: parsed.data.comment,
        },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "PROJECT_STATUS_CHANGE",
          entityType: "Project",
          entityId: project.id,
          summary: `Статус проекта ${project.number} изменён`,
          beforeData: { status: project.status },
          afterData: {
            status: parsed.data.status,
            comment: parsed.data.comment,
          },
        },
        tx,
      );
    });
    const statusRecipients = await prisma.projectResponsible.findMany({
      where: { projectId: project.id },
      select: { userId: true },
    });
    const recipientIds = [
      ...new Set([
        project.createdById,
        ...statusRecipients.map(({ userId }) => userId),
      ]),
    ];
    await createNotifications(
      recipientIds.map((userId) => ({
        userId,
        type: "STATUS_CHANGED" as const,
        title: "Изменён статус проекта",
        body: project.number + " · " + parsed.data.status,
        href: "/projects/" + project.id,
        dedupeKey:
          "project-status:" +
          project.id +
          ":" +
          parsed.data.status +
          ":" +
          userId +
          ":" +
          Date.now(),
      })),
    );
    revalidatePath("/projects");
    revalidatePath(`/projects/${project.id}`);
    return { ok: true, data: { id: project.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function addProjectCommentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = projectCommentSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.PROJECT_MANAGE);
    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.projectComment.create({
        data: { ...parsed.data, authorId: context.userId },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "PROJECT_COMMENT_ADD",
          entityType: "Project",
          entityId: parsed.data.projectId,
          summary: "Добавлен внутренний комментарий",
        },
        tx,
      );
      return created;
    });
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return { ok: true, data: { id: comment.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function addProjectTaskAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = projectTaskSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.PROJECT_MANAGE);
    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.workTask.create({
        data: { ...parsed.data, authorId: context.userId },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "PROJECT_TASK_CREATE",
          entityType: "Project",
          entityId: parsed.data.projectId,
          summary: `Создана задача: ${parsed.data.title}`,
          afterData: {
            assigneeId: parsed.data.assigneeId,
            dueAt: parsed.data.dueAt,
          },
        },
        tx,
      );
      return created;
    });
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return { ok: true, data: { id: task.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function addProjectEventAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = projectEventSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.PROJECT_MANAGE);
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.calendarEvent.create({ data: parsed.data });
      await writeAudit(
        {
          actorId: context.userId,
          action: "PROJECT_EVENT_CREATE",
          entityType: "Project",
          entityId: parsed.data.projectId,
          summary: `Добавлено событие: ${parsed.data.title}`,
          afterData: { type: parsed.data.type, startsAt: parsed.data.startsAt },
        },
        tx,
      );
      return created;
    });
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return { ok: true, data: { id: event.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function addProjectRoomAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = projectRoomSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.PROJECT_MANAGE);
    const room = await prisma.$transaction(async (tx) => {
      const created = await tx.projectRoom.create({ data: parsed.data });
      await writeAudit(
        {
          actorId: context.userId,
          action: "PROJECT_ROOM_CREATE",
          entityType: "Project",
          entityId: parsed.data.projectId,
          summary: `Добавлено помещение: ${parsed.data.name}`,
        },
        tx,
      );
      return created;
    });
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return { ok: true, data: { id: room.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function assignProjectUserAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.PROJECT_MANAGE);
    await prisma.$transaction(async (tx) => {
      await tx.projectResponsible.upsert({
        where: { projectId_userId_roleLabel: parsed.data },
        create: parsed.data,
        update: { assignedAt: new Date() },
      });
      await tx.projectAssignmentHistory.create({
        data: {
          ...parsed.data,
          action: "ASSIGNED",
          changedById: context.userId,
        },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "PROJECT_ASSIGN",
          entityType: "Project",
          entityId: parsed.data.projectId,
          summary: "Назначен ответственный",
          afterData: {
            userId: parsed.data.userId,
            roleLabel: parsed.data.roleLabel,
          },
        },
        tx,
      );
    });
    await createNotifications([
      {
        userId: parsed.data.userId,
        type: "ASSIGNMENT",
        title: "Новое назначение",
        body: "Вы назначены в проект: " + parsed.data.roleLabel,
        href: "/projects/" + parsed.data.projectId,
        dedupeKey:
          "project-assignment:" +
          parsed.data.projectId +
          ":" +
          parsed.data.userId +
          ":" +
          parsed.data.roleLabel,
      },
    ]);
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return { ok: true, data: { id: parsed.data.projectId } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function registerProjectFileAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = projectFileSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.PROJECT_MANAGE);
    const file = await prisma.$transaction(async (tx) => {
      const created = await tx.projectFile.create({
        data: { ...parsed.data, size: 0, uploadedById: context.userId },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "PROJECT_FILE_ADD",
          entityType: "Project",
          entityId: parsed.data.projectId,
          summary: `Прикреплён файл: ${parsed.data.name}`,
          afterData: {
            name: parsed.data.name,
            storageKey: parsed.data.storageKey,
          },
        },
        tx,
      );
      return created;
    });
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return { ok: true, data: { id: file.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function setProjectTaskStatusAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = taskStatusSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.PROJECT_MANAGE);
    const task = await prisma.$transaction(async (tx) => {
      const updated = await tx.workTask.update({
        where: { id: parsed.data.taskId, projectId: parsed.data.projectId },
        data: {
          status: parsed.data.status,
          completedAt: parsed.data.status === "DONE" ? new Date() : null,
        },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "PROJECT_TASK_STATUS",
          entityType: "Project",
          entityId: parsed.data.projectId,
          summary: `Изменён статус задачи: ${updated.title}`,
          afterData: { taskId: updated.id, status: updated.status },
        },
        tx,
      );
      return updated;
    });
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return { ok: true, data: { id: task.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
