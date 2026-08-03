"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/modules/audit/application/write-audit";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { calculateStockBalance } from "@/modules/inventory/domain";
import {
  adjustInventorySchema,
  createInventoryItemSchema,
} from "@/modules/inventory/schemas";
import { notifyRoles } from "@/modules/notifications/application/queries";
import type { ActionResult } from "@/shared/actions/action-result";
import { validationActionError } from "@/shared/actions/action-result";
import { handleActionError } from "@/shared/actions/handle-action-error";

export async function createInventoryItemAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createInventoryItemSchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({ data: parsed.data });
      await writeAudit(
        {
          actorId: context.userId,
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
    revalidatePath("/inventory");
    return { ok: true, data: { id: item.id } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}

export async function adjustInventoryAction(
  input: unknown,
): Promise<ActionResult<{ version: number }>> {
  const parsed = adjustInventorySchema.safeParse(input);
  if (!parsed.success) return validationActionError(parsed.error);
  try {
    const context = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
    const current = await prisma.inventoryItem.findUnique({
      where: { id: parsed.data.itemId },
    });
    if (!current)
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Материал не найден" },
      };
    if (current.version !== parsed.data.version)
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Остаток уже изменён. Обновите страницу.",
        },
      };
    let next;
    try {
      next = calculateStockBalance({
        quantity: Number(current.quantity),
        reserved: Number(current.reserved),
        quantityDelta: parsed.data.quantityDelta,
        reservedDelta: parsed.data.reservedDelta,
      });
    } catch (error: unknown) {
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message:
            error instanceof Error ? error.message : "Некорректный остаток",
        },
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.inventoryItem.updateMany({
        where: { id: current.id, version: current.version },
        data: {
          quantity: next.quantity,
          reserved: next.reserved,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) return false;
      await tx.stockMovement.create({
        data: {
          itemId: current.id,
          actorId: context.userId,
          type: parsed.data.type,
          quantityDelta: parsed.data.quantityDelta,
          reservedDelta: parsed.data.reservedDelta,
          quantityAfter: next.quantity,
          reservedAfter: next.reserved,
          reason: parsed.data.reason,
        },
      });
      await writeAudit(
        {
          actorId: context.userId,
          action: "INVENTORY_ADJUST",
          entityType: "InventoryItem",
          entityId: current.id,
          summary: "Изменён складской остаток",
          beforeData: {
            quantity: current.quantity,
            reserved: current.reserved,
            version: current.version,
          },
          afterData: {
            quantity: next.quantity,
            reserved: next.reserved,
            version: current.version + 1,
            reason: parsed.data.reason,
          },
        },
        tx,
      );
      return true;
    });
    if (!updated)
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Остаток уже изменён. Обновите страницу.",
        },
      };

    if (next.available < Number(current.minimumQuantity)) {
      await notifyRoles(["WAREHOUSE_MANAGER", "MANAGER", "ADMIN"], {
        type: "MATERIAL_SHORTAGE",
        title: "Нехватка материала",
        body:
          current.name + " · доступно " + next.available + " " + current.unit,
        href: "/inventory",
        dedupeKeyPrefix:
          "material-shortage:" + current.id + ":" + (current.version + 1),
      });
    }
    revalidatePath("/inventory");
    revalidatePath("/analytics");
    return { ok: true, data: { version: current.version + 1 } };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
