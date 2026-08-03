"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/modules/audit/application/write-audit";
import {
  AuthorizationError,
  requirePermission,
} from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { hasPermission } from "@/modules/auth/domain/rbac";
import {
  createEstimateSchema,
  tariffUpdateSchema,
} from "@/modules/estimates/application/schemas";
import { calculateEstimate } from "@/modules/estimates/domain/calculator";
import type { ActionResult } from "@/shared/actions/action-result";
import { validationActionError } from "@/shared/actions/action-result";
import { handleActionError } from "@/shared/actions/handle-action-error";

export async function createEstimateAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createEstimateSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.ESTIMATE_CREATE);
    if (
      parsed.data.discountPercent > 0 &&
      !hasPermission(
        context.permissions,
        PERMISSIONS.ESTIMATE_CLIENT_PRICE_MANAGE,
      )
    ) {
      throw new AuthorizationError();
    }
    const canManageProjects = hasPermission(
      context.permissions,
      PERMISSIONS.PROJECT_MANAGE,
    );
    const measurement = await prisma.measurement.findFirst({
      where: {
        id: parsed.data.measurementId,
        ...(canManageProjects ? {} : { measurerId: context.userId }),
      },
      include: { rooms: { orderBy: { sortOrder: "asc" } } },
    });
    if (!measurement)
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Назначенный замер не найден" },
      };
    if (measurement.status !== "COMPLETED")
      return {
        ok: false,
        error: { code: "CONFLICT", message: "Сначала завершите замер" },
      };
    const tariffs = await prisma.tariff.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    });
    const calculation = calculateEstimate({
      rooms: measurement.rooms.map((room) => ({
        id: room.id,
        name: room.name,
        area: Number(room.area ?? 0),
        perimeter: Number(room.perimeter ?? 0),
        corners: room.corners,
        canvasType: room.canvasType,
        profileType: room.profileType,
        profileLength:
          room.profileLength === null ? null : Number(room.profileLength),
        insertLength:
          room.insertLength === null ? null : Number(room.insertLength),
        pipes: room.pipes,
        lights: room.lights,
        chandeliers: room.chandeliers,
        tracks: Number(room.tracks),
        cornices: Number(room.cornices),
        niches: Number(room.niches),
        ventilation: room.ventilation,
        sensors: room.sensors,
        cabinetBypass: Number(room.cabinetBypass),
        additionalWorkUnits: Number(room.additionalWorkUnits),
        complexityCoefficient: Number(room.complexityCoefficient),
      })),
      tariffs: tariffs.map((rate) => ({
        code: rate.code,
        name: rate.name,
        unit: rate.unit,
        internalPrice: Number(rate.internalPrice),
        clientPrice: Number(rate.clientPrice),
      })),
      discountPercent: parsed.data.discountPercent,
      transportZoneCode: parsed.data.transportZoneCode,
    });

    const estimate = await prisma.$transaction(async (tx) => {
      const latest = await tx.estimate.aggregate({
        where: { projectId: measurement.projectId },
        _max: { version: true },
      });
      const version = (latest._max.version ?? 0) + 1;
      const created = await tx.estimate.create({
        data: {
          projectId: measurement.projectId,
          measurementId: measurement.id,
          version,
          status: "FINAL",
          authorId: context.userId,
          tariffSnapshot: tariffs.map((rate) => ({
            code: rate.code,
            name: rate.name,
            unit: rate.unit,
            internalPrice: Number(rate.internalPrice),
            clientPrice: Number(rate.clientPrice),
            metadata: rate.metadata,
          })),
          discountPercent: calculation.discountPercent,
          subtotalInternal: calculation.subtotalInternal,
          subtotalClient: calculation.subtotalClient,
          discountAmount: calculation.discountAmount,
          totalInternal: calculation.totalInternal,
          totalClient: calculation.totalClient,
          finalizedAt: new Date(),
          lines: {
            create: calculation.lines.map((line, sortOrder) => ({
              roomId: line.roomId,
              code: line.code,
              description: line.roomName
                ? `${line.roomName}: ${line.description}`
                : line.description,
              quantity: line.quantity,
              unit: line.unit,
              internalUnitPrice: line.internalUnitPrice,
              clientUnitPrice: line.clientUnitPrice,
              internalAmount: line.internalAmount,
              clientAmount: line.clientAmount,
              sortOrder,
            })),
          },
        },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "ESTIMATE_CREATE",
          entityType: "Estimate",
          entityId: created.id,
          summary: `Создана смета версии ${version}`,
          afterData: {
            projectId: measurement.projectId,
            version,
            lineCount: calculation.lines.length,
            tariffCodes: tariffs.map((rate) => rate.code),
          },
        },
        tx,
      );
      return created;
    });
    revalidatePath(`/measurements/${measurement.id}`);
    revalidatePath(`/projects/${measurement.projectId}`);
    return { ok: true, data: { id: estimate.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function updateTariffAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = tariffUpdateSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.TARIFF_MANAGE);
    const before = await prisma.tariff.findUnique({
      where: { id: parsed.data.id },
    });
    if (!before)
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Тариф не найден" },
      };
    await prisma.$transaction(async (tx) => {
      await tx.tariff.update({
        where: { id: parsed.data.id },
        data: { ...parsed.data, updatedById: context.userId },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "TARIFF_UPDATE",
          entityType: "Tariff",
          entityId: parsed.data.id,
          summary: `Изменён тариф ${before.code}`,
          beforeData: {
            internalPrice: Number(before.internalPrice),
            clientPrice: Number(before.clientPrice),
            isActive: before.isActive,
          },
          afterData: parsed.data,
        },
        tx,
      );
    });
    revalidatePath("/settings/tariffs");
    return { ok: true, data: { id: parsed.data.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
