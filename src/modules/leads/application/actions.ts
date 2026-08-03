"use server";

import { randomInt } from "node:crypto";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/modules/audit/application/write-audit";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import {
  callLogSchema,
  createLeadSchema,
  createProjectFromLeadSchema,
  measurementSchema,
  leadTaskSchema,
} from "@/modules/leads/application/schemas";
import { normalizePhone } from "@/modules/leads/domain/phone";
import type { ActionResult } from "@/shared/actions/action-result";
import { validationActionError } from "@/shared/actions/action-result";
import { handleActionError } from "@/shared/actions/handle-action-error";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

async function pickOperatorId(): Promise<string | null> {
  const operator = await prisma.user.findFirst({
    where: {
      isActive: true,
      blockedAt: null,
      roles: { some: { role: { code: "AD_OPERATOR", isActive: true } } },
    },
    orderBy: { assignedTasks: { _count: "asc" } },
    select: { id: true },
  });
  return operator?.id ?? null;
}

export async function createLeadAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createLeadSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);

  try {
    const context = await requirePermission(PERMISSIONS.LEAD_CREATE);
    const phoneNormalized = normalizePhone(parsed.data.phone);
    if (phoneNormalized.length < 10 || phoneNormalized.length > 15) {
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Введите корректный номер телефона",
        },
      };
    }
    const duplicate = await prisma.lead.findUnique({
      where: { phoneNormalized },
      select: { id: true },
    });
    if (duplicate) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Заявка с этим телефоном уже зарегистрирована",
        },
      };
    }
    const operatorId = await pickOperatorId();
    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          ...parsed.data,
          phone: parsed.data.phone,
          phoneNormalized,
          source: "PROMOTER",
          authorId: context.userId,
          operatorId,
        },
      });
      await tx.workTask.create({
        data: {
          title: "Позвонить по новой заявке",
          type: "CALL",
          dueAt: new Date(Date.now() + 30 * 60 * 1000),
          leadId: created.id,
          assigneeId: operatorId,
          authorId: context.userId,
        },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "LEAD_CREATE",
          entityType: "Lead",
          entityId: created.id,
          summary: "Создана заявка промоутером",
          afterData: { source: "PROMOTER", status: created.status, operatorId },
        },
        tx,
      );
      return created;
    });
    revalidatePath("/leads");
    return { ok: true, data: { id: lead.id } };
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Заявка с этим телефоном уже зарегистрирована",
        },
      };
    }
    return handleActionError(error);
  }
}

export async function logCallAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = callLogSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.LEAD_MANAGE);
    if (parsed.data.result === "DECLINED" && !parsed.data.declineReason) {
      return {
        ok: false,
        error: { code: "VALIDATION", message: "Укажите причину отказа" },
      };
    }
    const call = await prisma.$transaction(async (tx) => {
      const created = await tx.callLog.create({
        data: {
          leadId: parsed.data.leadId,
          authorId: context.userId,
          result: parsed.data.result,
          note: parsed.data.note,
          nextContactAt: parsed.data.nextContactAt,
        },
      });
      const status =
        parsed.data.result === "DECLINED" ||
        parsed.data.result === "WRONG_NUMBER"
          ? "DECLINED"
          : parsed.data.result === "INTERESTED" ||
              parsed.data.result === "MEASUREMENT"
            ? "QUALIFIED"
            : "CONTACTED";
      await tx.lead.update({
        where: { id: parsed.data.leadId },
        data: {
          status,
          operatorId: context.userId,
          declineReason: parsed.data.declineReason,
          qualifiedAt: status === "QUALIFIED" ? new Date() : undefined,
        },
      });
      if (parsed.data.nextContactAt) {
        await tx.workTask.create({
          data: {
            leadId: parsed.data.leadId,
            authorId: context.userId,
            assigneeId: context.userId,
            title: "Повторно связаться с клиентом",
            type: "FOLLOW_UP",
            dueAt: parsed.data.nextContactAt,
          },
        });
      }
      await writeAudit(
        {
          actorId: context.userId,
          action: "LEAD_CALL_LOG",
          entityType: "Lead",
          entityId: parsed.data.leadId,
          summary: "Записан результат звонка",
          afterData: {
            result: parsed.data.result,
            status,
            nextContactAt: parsed.data.nextContactAt,
          },
        },
        tx,
      );
      return created;
    });
    revalidatePath("/leads");
    revalidatePath(`/leads/${parsed.data.leadId}`);
    return { ok: true, data: { id: call.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function scheduleMeasurementAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = measurementSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.LEAD_MANAGE);
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: parsed.data.leadId },
        data: {
          status: "QUALIFIED",
          measurementAt: parsed.data.measurementAt,
          measurerId: parsed.data.measurerId,
          qualifiedAt: new Date(),
        },
      });
      await tx.workTask.create({
        data: {
          leadId: parsed.data.leadId,
          authorId: context.userId,
          assigneeId: parsed.data.measurerId,
          title: "Провести замер",
          description: parsed.data.note,
          type: "MEASUREMENT",
          dueAt: parsed.data.measurementAt,
        },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "LEAD_MEASUREMENT_SCHEDULE",
          entityType: "Lead",
          entityId: parsed.data.leadId,
          summary: "Назначен замер по заявке",
          afterData: {
            measurementAt: parsed.data.measurementAt,
            measurerId: parsed.data.measurerId,
          },
        },
        tx,
      );
    });
    revalidatePath(`/leads/${parsed.data.leadId}`);
    return { ok: true, data: { id: parsed.data.leadId } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function createProjectFromLeadAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createProjectFromLeadSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.PROJECT_MANAGE);
    const lead = await prisma.lead.findUnique({
      where: { id: parsed.data.leadId },
    });
    if (!lead)
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Заявка не найдена" },
      };
    if (!["QUALIFIED", "CONTACTED"].includes(lead.status)) {
      return {
        ok: false,
        error: { code: "CONFLICT", message: "Сначала квалифицируйте заявку" },
      };
    }
    const number = `APT-${new Date().getFullYear()}-${randomInt(100000, 999999)}`;
    const project = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { phoneNormalized: lead.phoneNormalized },
        create: {
          name: parsed.data.customerName,
          phone: lead.phone,
          phoneNormalized: lead.phoneNormalized,
          address: parsed.data.address,
        },
        update: {
          name: parsed.data.customerName,
          address: parsed.data.address,
        },
      });
      const created = await tx.project.create({
        data: {
          number,
          customerId: customer.id,
          leadId: lead.id,
          source: lead.source,
          address: parsed.data.address,
          description: parsed.data.description,
          createdById: context.userId,
          ...(lead.measurerId && lead.measurementAt
            ? {
                measurements: {
                  create: {
                    measurerId: lead.measurerId,
                    scheduledAt: lead.measurementAt,
                    district: lead.districtOrAddress,
                    objectType: lead.housingType,
                    operatorComment: lead.comment,
                    requiredDocuments: [],
                  },
                },
              }
            : {}),
          statusHistory: {
            create: {
              toStatus: "QUALIFIED",
              changedById: context.userId,
              comment: "Создан из квалифицированного лида",
            },
          },
        },
      });
      await tx.lead.update({
        where: { id: lead.id },
        data: { status: "CONVERTED" },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "PROJECT_CREATE",
          entityType: "Project",
          entityId: created.id,
          summary: `Создан проект ${number}`,
          afterData: {
            leadId: lead.id,
            status: "QUALIFIED",
            source: lead.source,
          },
        },
        tx,
      );
      return created;
    });
    revalidatePath("/leads");
    revalidatePath("/projects");
    return { ok: true, data: { id: project.id } };
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Проект по этой заявке уже существует",
        },
      };
    }
    return handleActionError(error);
  }
}

export async function createLeadTaskAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = leadTaskSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.LEAD_MANAGE);
    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.workTask.create({
        data: {
          ...parsed.data,
          type: "GENERAL",
          assigneeId: context.userId,
          authorId: context.userId,
        },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "LEAD_TASK_CREATE",
          entityType: "Lead",
          entityId: parsed.data.leadId,
          summary: `Создана задача: ${parsed.data.title}`,
          afterData: { taskId: created.id, dueAt: parsed.data.dueAt },
        },
        tx,
      );
      return created;
    });
    revalidatePath(`/leads/${parsed.data.leadId}`);
    return { ok: true, data: { id: task.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
