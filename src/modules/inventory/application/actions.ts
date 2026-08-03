"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/modules/audit/application/write-audit";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import {
  calculateStockBalance,
  requirementStatus,
} from "@/modules/inventory/domain";
import {
  archiveInventoryItemSchema,
  createCategorySchema,
  createInventoryItemSchema,
  createLocationSchema,
  createPurchaseOrderSchema,
  createRequirementSchema,
  createSupplierPriceSchema,
  createSupplierSchema,
  createUnitSchema,
  generateRequirementsSchema,
  requirementOperationSchema,
  reserveRequirementSchema,
  stockMovementSchema,
} from "@/modules/inventory/schemas";
import type { ActionResult } from "@/shared/actions/action-result";
import { validationActionError } from "@/shared/actions/action-result";
import { handleActionError } from "@/shared/actions/handle-action-error";

const ok = (id: string): ActionResult<{ id: string }> => ({
  ok: true,
  data: { id },
});
const conflict = (message: string): ActionResult<never> => ({
  ok: false,
  error: { code: "CONFLICT", message },
});
const refresh = () => {
  revalidatePath("/inventory");
  revalidatePath("/inventory/requirements");
  revalidatePath("/inventory/shortage");
  revalidatePath("/analytics");
};

export async function createCategoryAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryCategory.create({ data: parsed.data });
      await writeAudit(
        {
          actorId: ctx.userId,
          action: "INVENTORY_CATEGORY_CREATE",
          entityType: "InventoryCategory",
          entityId: created.id,
          summary: "Создана категория склада",
          afterData: parsed.data,
        },
        tx,
      );
      return created;
    });
    refresh();
    return ok(row.id);
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
export async function createUnitAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createUnitSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryUnit.create({ data: parsed.data });
      await writeAudit(
        {
          actorId: ctx.userId,
          action: "INVENTORY_UNIT_CREATE",
          entityType: "InventoryUnit",
          entityId: created.id,
          summary: "Создана единица измерения",
          afterData: parsed.data,
        },
        tx,
      );
      return created;
    });
    refresh();
    return ok(row.id);
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
export async function createLocationAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createLocationSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryLocation.create({ data: parsed.data });
      await writeAudit(
        {
          actorId: ctx.userId,
          action: "INVENTORY_LOCATION_CREATE",
          entityType: "InventoryLocation",
          entityId: created.id,
          summary: "Создана складская локация",
          afterData: parsed.data,
        },
        tx,
      );
      return created;
    });
    refresh();
    return ok(row.id);
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
export async function createSupplierAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createSupplierSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({ data: parsed.data });
      await writeAudit(
        {
          actorId: ctx.userId,
          action: "SUPPLIER_CREATE",
          entityType: "Supplier",
          entityId: created.id,
          summary: "Создан поставщик",
          afterData: parsed.data,
        },
        tx,
      );
      return created;
    });
    refresh();
    return ok(row.id);
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
export async function createSupplierPriceAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createSupplierPriceSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.supplierPrice.create({ data: parsed.data });
      await tx.inventoryItem.update({
        where: { id: parsed.data.itemId },
        data: { purchasePrice: parsed.data.price },
      });
      await writeAudit(
        {
          actorId: ctx.userId,
          action: "SUPPLIER_PRICE_CREATE",
          entityType: "SupplierPrice",
          entityId: created.id,
          summary: "Обновлена закупочная цена",
          afterData: parsed.data,
        },
        tx,
      );
      return created;
    });
    refresh();
    return ok(row.id);
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
export async function createInventoryItemAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createInventoryItemSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
    const unit = await prisma.inventoryUnit.findUnique({
      where: { id: parsed.data.unitId },
    });
    if (!unit) return conflict("Единица измерения не найдена");
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({
        data: { ...parsed.data, unit: unit.symbol, quantity: 0, reserved: 0 },
      });
      await tx.inventoryBalance.create({
        data: { itemId: created.id, locationId: parsed.data.defaultLocationId },
      });
      await writeAudit(
        {
          actorId: ctx.userId,
          action: "INVENTORY_ITEM_CREATE",
          entityType: "InventoryItem",
          entityId: created.id,
          summary: "Создан складской материал",
          afterData: parsed.data,
        },
        tx,
      );
      return created;
    });
    refresh();
    return ok(row.id);
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
export async function archiveInventoryItemAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = archiveInventoryItemSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryItem.update({
        where: { id: parsed.data.itemId },
        data: {
          isActive: !parsed.data.archived,
          archivedAt: parsed.data.archived ? new Date() : null,
        },
      });
      await writeAudit(
        {
          actorId: ctx.userId,
          action: parsed.data.archived
            ? "INVENTORY_ITEM_ARCHIVE"
            : "INVENTORY_ITEM_RESTORE",
          entityType: "InventoryItem",
          entityId: updated.id,
          summary: parsed.data.archived
            ? "Материал архивирован"
            : "Материал восстановлен",
        },
        tx,
      );
      return updated;
    });
    refresh();
    return ok(item.id);
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function recordStockMovementAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = stockMovementSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
    const canNegative = ctx.permissions.has(
      PERMISSIONS.INVENTORY_NEGATIVE_ALLOW,
    );
    if (parsed.data.allowNegative && !canNegative)
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Нет специального разрешения на отрицательный остаток",
        },
      };
    const movement = await prisma.$transaction(async (tx) => {
      const source = await tx.inventoryBalance.findUnique({
        where: {
          itemId_locationId: {
            itemId: parsed.data.itemId,
            locationId: parsed.data.locationId,
          },
        },
      });
      if (!source) throw new Error("Остаток в выбранной локации не найден");
      const signed =
        parsed.data.type === "RECEIPT"
          ? parsed.data.quantity
          : parsed.data.type === "ADJUSTMENT" &&
              parsed.data.adjustmentDirection === "INCREASE"
            ? parsed.data.quantity
            : -parsed.data.quantity;
      if (parsed.data.type === "TRANSFER") {
        const target = await tx.inventoryBalance.upsert({
          where: {
            itemId_locationId: {
              itemId: parsed.data.itemId,
              locationId: parsed.data.toLocationId!,
            },
          },
          create: {
            itemId: parsed.data.itemId,
            locationId: parsed.data.toLocationId!,
          },
          update: {},
        });
        const nextSource = calculateStockBalance({
          quantity: Number(source.quantity),
          reserved: Number(source.reserved),
          quantityDelta: -parsed.data.quantity,
          reservedDelta: 0,
          allowNegative: parsed.data.allowNegative && canNegative,
        });
        const changed = await tx.inventoryBalance.updateMany({
          where: { id: source.id, version: source.version },
          data: { quantity: nextSource.quantity, version: { increment: 1 } },
        });
        if (changed.count !== 1) throw new Error("CONCURRENT_STOCK");
        await tx.inventoryBalance.update({
          where: { id: target.id },
          data: {
            quantity: { increment: parsed.data.quantity },
            version: { increment: 1 },
          },
        });
        const created = await tx.stockMovement.create({
          data: {
            itemId: parsed.data.itemId,
            actorId: ctx.userId,
            type: "TRANSFER",
            quantity: parsed.data.quantity,
            quantityDelta: 0,
            reservedDelta: 0,
            quantityBefore: source.quantity,
            quantityAfter: nextSource.quantity,
            reservedBefore: source.reserved,
            reservedAfter: source.reserved,
            destinationQuantityBefore: target.quantity,
            destinationQuantityAfter:
              Number(target.quantity) + parsed.data.quantity,
            fromLocationId: source.locationId,
            toLocationId: target.locationId,
            projectId: parsed.data.projectId,
            documentRef: parsed.data.documentRef,
            reason: parsed.data.comment,
          },
        });
        return created;
      }
      const next = calculateStockBalance({
        quantity: Number(source.quantity),
        reserved: Number(source.reserved),
        quantityDelta: signed,
        reservedDelta: 0,
        allowNegative: parsed.data.allowNegative && canNegative,
      });
      const changed = await tx.inventoryBalance.updateMany({
        where: { id: source.id, version: source.version },
        data: { quantity: next.quantity, version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new Error("CONCURRENT_STOCK");
      await tx.inventoryItem.update({
        where: { id: parsed.data.itemId },
        data: { quantity: { increment: signed }, version: { increment: 1 } },
      });
      return tx.stockMovement.create({
        data: {
          itemId: parsed.data.itemId,
          actorId: ctx.userId,
          type: parsed.data.type,
          quantity: parsed.data.quantity,
          quantityDelta: signed,
          reservedDelta: 0,
          quantityBefore: source.quantity,
          quantityAfter: next.quantity,
          reservedBefore: source.reserved,
          reservedAfter: source.reserved,
          fromLocationId:
            parsed.data.type === "RECEIPT" ? null : source.locationId,
          toLocationId:
            parsed.data.type === "RECEIPT" ? source.locationId : null,
          projectId: parsed.data.projectId,
          documentRef: parsed.data.documentRef,
          reason: parsed.data.comment,
        },
      });
    });
    await prisma.$transaction(async (tx) =>
      writeAudit(
        {
          actorId: ctx.userId,
          action: "STOCK_MOVEMENT_CREATE",
          entityType: "StockMovement",
          entityId: movement.id,
          summary: "Проведено складское движение",
          afterData: {
            type: parsed.data.type,
            quantity: parsed.data.quantity,
            itemId: parsed.data.itemId,
          },
        },
        tx,
      ),
    );
    refresh();
    return ok(movement.id);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CONCURRENT_STOCK")
      return conflict(
        "Остаток уже изменён другим пользователем. Повторите операцию.",
      );
    return handleActionError(error);
  }
}

export async function createRequirementAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createRequirementSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.projectMaterialRequirement.create({
        data: parsed.data,
      });
      await writeAudit(
        {
          actorId: ctx.userId,
          action: "PROJECT_MATERIAL_REQUIREMENT_CREATE",
          entityType: "ProjectMaterialRequirement",
          entityId: created.id,
          summary: "Создана потребность проекта",
          afterData: parsed.data,
        },
        tx,
      );
      return created;
    });
    refresh();
    return ok(row.id);
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
export async function generateRequirementsAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = generateRequirementsSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
    const estimate = await prisma.estimate.findFirst({
      where: { id: parsed.data.estimateId, projectId: parsed.data.projectId },
      include: { lines: true },
    });
    if (!estimate) return conflict("Смета проекта не найдена");
    const codes = [...new Set(estimate.lines.map((line) => line.code))];
    const items = await prisma.inventoryItem.findMany({
      where: { code: { in: codes }, isActive: true },
    });
    const byCode = new Map(items.map((item) => [item.code, item]));
    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const line of estimate.lines) {
        const item = byCode.get(line.code);
        if (!item) continue;
        rows.push(
          await tx.projectMaterialRequirement.create({
            data: {
              projectId: parsed.data.projectId,
              estimateId: estimate.id,
              installationId: parsed.data.installationId,
              roomId: line.roomId,
              itemId: item.id,
              required: line.quantity,
            },
          }),
        );
      }
      await writeAudit(
        {
          actorId: ctx.userId,
          action: "PROJECT_MATERIALS_GENERATE",
          entityType: "Estimate",
          entityId: estimate.id,
          summary: "Потребности проекта созданы по смете",
          afterData: { count: rows.length },
        },
        tx,
      );
      return rows;
    });
    refresh();
    return ok(created[0]?.id ?? estimate.id);
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function reserveRequirementAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = reserveRequirementSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
    const reservation = await prisma.$transaction(async (tx) => {
      const requirement = await tx.projectMaterialRequirement.findUnique({
        where: { id: parsed.data.requirementId },
      });
      if (!requirement) throw new Error("Потребность не найдена");
      if (
        Number(requirement.reserved) + parsed.data.quantity >
        Number(requirement.required) -
          Number(requirement.issued) -
          Number(requirement.consumed)
      )
        throw new Error("Количество превышает незакрытую потребность");
      const balance = await tx.inventoryBalance.findUnique({
        where: {
          itemId_locationId: {
            itemId: requirement.itemId,
            locationId: parsed.data.locationId,
          },
        },
      });
      if (!balance) throw new Error("Материал отсутствует в выбранной локации");
      const next = calculateStockBalance({
        quantity: Number(balance.quantity),
        reserved: Number(balance.reserved),
        quantityDelta: 0,
        reservedDelta: parsed.data.quantity,
      });
      const changed = await tx.inventoryBalance.updateMany({
        where: { id: balance.id, version: balance.version },
        data: { reserved: next.reserved, version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new Error("CONCURRENT_STOCK");
      await tx.inventoryItem.update({
        where: { id: requirement.itemId },
        data: {
          reserved: { increment: parsed.data.quantity },
          version: { increment: 1 },
        },
      });
      const status = requirementStatus({
        required: Number(requirement.required),
        reserved: Number(requirement.reserved) + parsed.data.quantity,
        issued: Number(requirement.issued),
        consumed: Number(requirement.consumed),
        returned: Number(requirement.returned),
        writtenOff: Number(requirement.writtenOff),
      });
      await tx.projectMaterialRequirement.update({
        where: { id: requirement.id },
        data: {
          reserved: { increment: parsed.data.quantity },
          status,
          version: { increment: 1 },
        },
      });
      const row = await tx.stockReservation.create({
        data: {
          requirementId: requirement.id,
          balanceId: balance.id,
          quantity: parsed.data.quantity,
          reservedById: ctx.userId,
        },
      });
      await tx.stockMovement.create({
        data: {
          itemId: requirement.itemId,
          actorId: ctx.userId,
          type: "RESERVATION",
          quantity: parsed.data.quantity,
          quantityDelta: 0,
          reservedDelta: parsed.data.quantity,
          quantityBefore: balance.quantity,
          quantityAfter: balance.quantity,
          reservedBefore: balance.reserved,
          reservedAfter: next.reserved,
          projectId: requirement.projectId,
          installationId: requirement.installationId,
          requirementId: requirement.id,
          reservationId: row.id,
          fromLocationId: balance.locationId,
          reason: "Резерв под проект",
        },
      });
      await writeAudit(
        {
          actorId: ctx.userId,
          action: "STOCK_RESERVE",
          entityType: "StockReservation",
          entityId: row.id,
          summary: "Материал зарезервирован",
          afterData: {
            quantity: parsed.data.quantity,
            requirementId: requirement.id,
          },
        },
        tx,
      );
      return row;
    });
    refresh();
    return ok(reservation.id);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CONCURRENT_STOCK")
      return conflict("Одновременный резерв отклонён. Обновите данные.");
    return handleActionError(error);
  }
}

export async function requirementOperationAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = requirementOperationSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
    const movement = await prisma.$transaction(async (tx) => {
      const req = await tx.projectMaterialRequirement.findUnique({
        where: { id: parsed.data.requirementId },
      });
      if (!req) throw new Error("Потребность не найдена");
      const reservation = parsed.data.reservationId
        ? await tx.stockReservation.findUnique({
            where: { id: parsed.data.reservationId },
            include: { balance: true },
          })
        : null;
      let r = Number(req.reserved),
        issued = Number(req.issued),
        consumed = Number(req.consumed),
        returned = Number(req.returned),
        writtenOff = Number(req.writtenOff);
      const balance = reservation?.balance;
      let qDelta = 0,
        rDelta = 0;
      const op = parsed.data.operation;
      if (!reservation) throw new Error("Выберите резерв или выдачу");
      const availableIssued =
        Number(reservation.issued) -
        Number(reservation.returned) -
        Number(reservation.consumed) -
        Number(reservation.writtenOff);
      if (op === "RELEASE") {
        if (
          parsed.data.quantity >
          Number(reservation!.quantity) -
            Number(reservation!.issued) -
            Number(reservation!.released)
        )
          throw new Error("Нельзя снять резерв повторно");
        r -= parsed.data.quantity;
        rDelta = -parsed.data.quantity;
        await tx.stockReservation.update({
          where: { id: reservation!.id },
          data: {
            released: { increment: parsed.data.quantity },
            status: "RELEASED",
          },
        });
      } else if (op === "ISSUE") {
        if (
          parsed.data.quantity > r ||
          parsed.data.quantity >
            Number(reservation!.quantity) -
              Number(reservation!.issued) -
              Number(reservation!.released)
        )
          throw new Error("Недостаточно зарезервировано для выдачи");
        r -= parsed.data.quantity;
        issued += parsed.data.quantity;
        qDelta = -parsed.data.quantity;
        rDelta = -parsed.data.quantity;
        await tx.stockReservation.update({
          where: { id: reservation!.id },
          data: {
            issued: { increment: parsed.data.quantity },
            status: "ISSUED",
          },
        });
      } else if (op === "RETURN") {
        if (
          parsed.data.quantity > issued ||
          parsed.data.quantity > availableIssued
        )
          throw new Error("Нельзя вернуть больше выданного по этой выдаче");
        issued -= parsed.data.quantity;
        returned += parsed.data.quantity;
        qDelta = parsed.data.quantity;
        await tx.stockReservation.update({
          where: { id: reservation!.id },
          data: { returned: { increment: parsed.data.quantity } },
        });
      } else if (op === "CONSUMPTION") {
        if (
          parsed.data.quantity > issued ||
          parsed.data.quantity > availableIssued
        )
          throw new Error("Нельзя дважды списать использованный материал");
        issued -= parsed.data.quantity;
        consumed += parsed.data.quantity;
        await tx.stockReservation.update({
          where: { id: reservation!.id },
          data: { consumed: { increment: parsed.data.quantity } },
        });
      } else {
        if (
          parsed.data.quantity > issued ||
          parsed.data.quantity > availableIssued
        )
          throw new Error("Нельзя списать больше выданного по этой выдаче");
        issued -= parsed.data.quantity;
        writtenOff += parsed.data.quantity;
        await tx.stockReservation.update({
          where: { id: reservation!.id },
          data: { writtenOff: { increment: parsed.data.quantity } },
        });
      }
      if (balance && (qDelta !== 0 || rDelta !== 0)) {
        const next = calculateStockBalance({
          quantity: Number(balance.quantity),
          reserved: Number(balance.reserved),
          quantityDelta: qDelta,
          reservedDelta: rDelta,
        });
        const changed = await tx.inventoryBalance.updateMany({
          where: { id: balance.id, version: balance.version },
          data: {
            quantity: next.quantity,
            reserved: next.reserved,
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) throw new Error("CONCURRENT_STOCK");
        await tx.inventoryItem.update({
          where: { id: req.itemId },
          data: {
            quantity: { increment: qDelta },
            reserved: { increment: rDelta },
            version: { increment: 1 },
          },
        });
      }
      const status = requirementStatus({
        required: Number(req.required),
        reserved: r,
        issued,
        consumed,
        returned,
        writtenOff,
      });
      await tx.projectMaterialRequirement.update({
        where: { id: req.id },
        data: {
          reserved: r,
          issued,
          consumed,
          returned,
          writtenOff,
          status,
          version: { increment: 1 },
        },
      });
      const beforeQ = balance ? Number(balance.quantity) : 0,
        beforeR = balance ? Number(balance.reserved) : 0;
      const afterQ = beforeQ + qDelta,
        afterR = beforeR + rDelta;
      const row = await tx.stockMovement.create({
        data: {
          itemId: req.itemId,
          actorId: ctx.userId,
          type: op,
          quantity: parsed.data.quantity,
          quantityDelta: qDelta,
          reservedDelta: rDelta,
          quantityBefore: beforeQ,
          quantityAfter: afterQ,
          reservedBefore: beforeR,
          reservedAfter: afterR,
          projectId: req.projectId,
          installationId: req.installationId,
          requirementId: req.id,
          reservationId: reservation?.id,
          fromLocationId: balance?.locationId,
          documentRef: parsed.data.documentRef,
          reason: parsed.data.comment,
        },
      });
      await writeAudit(
        {
          actorId: ctx.userId,
          action: "STOCK_" + op,
          entityType: "StockMovement",
          entityId: row.id,
          summary: "Операция с материалом проекта",
          afterData: { quantity: parsed.data.quantity, requirementId: req.id },
        },
        tx,
      );
      return row;
    });
    refresh();
    return ok(movement.id);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CONCURRENT_STOCK")
      return conflict("Остаток изменён другим пользователем");
    return handleActionError(error);
  }
}

export async function createPurchaseOrderAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createPurchaseOrderSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          number: parsed.data.number,
          supplierId: parsed.data.supplierId,
          status: "ORDERED",
          expectedAt: parsed.data.expectedAt,
          documentRef: parsed.data.documentRef,
          comment: parsed.data.comment,
          createdById: ctx.userId,
          items: {
            create: {
              itemId: parsed.data.itemId,
              ordered: parsed.data.ordered,
              unitPrice: parsed.data.unitPrice,
            },
          },
        },
      });
      await writeAudit(
        {
          actorId: ctx.userId,
          action: "PURCHASE_ORDER_CREATE",
          entityType: "PurchaseOrder",
          entityId: created.id,
          summary: "Создан заказ поставщику",
          afterData: parsed.data,
        },
        tx,
      );
      return created;
    });
    refresh();
    return ok(row.id);
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
