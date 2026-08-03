import "server-only";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/auth/application/auth-context";
import { PERMISSIONS } from "@/modules/auth/domain/permissions";
import { shortage } from "@/modules/inventory/domain";

export async function listInventory() {
  const context = await requirePermission(PERMISSIONS.INVENTORY_READ);
  const [
    items,
    categories,
    units,
    locations,
    suppliers,
    projects,
    purchaseOrders,
  ] = await Promise.all([
    prisma.inventoryItem.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: {
        category: true,
        unitDefinition: true,
        defaultLocation: true,
        balances: { include: { location: true } },
        supplierPrices: {
          orderBy: { validFrom: "desc" },
          take: 3,
          include: { supplier: true },
        },
        movements: {
          orderBy: { createdAt: "desc" },
          take: 8,
          include: {
            actor: { select: { name: true } },
            fromLocation: true,
            toLocation: true,
          },
        },
      },
    }),
    prisma.inventoryCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.inventoryUnit.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.inventoryLocation.findMany({ orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({
      where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
      select: { id: true, number: true, address: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] } },
      include: { supplier: true, items: { include: { item: true } } },
      orderBy: { expectedAt: "asc" },
    }),
  ]);
  return {
    items,
    categories,
    units,
    locations,
    suppliers,
    projects,
    purchaseOrders,
    canManage: context.permissions.has(PERMISSIONS.INVENTORY_MANAGE),
    canNegative: context.permissions.has(PERMISSIONS.INVENTORY_NEGATIVE_ALLOW),
  };
}

export async function listMaterialRequirements() {
  const context = await requirePermission(PERMISSIONS.INVENTORY_READ);
  const [
    requirements,
    locations,
    projects,
    estimates,
    installations,
    expectedRows,
  ] = await Promise.all([
    prisma.projectMaterialRequirement.findMany({
      where: { status: { notIn: ["CANCELLED", "USED"] } },
      include: {
        project: { select: { number: true, address: true } },
        room: { select: { name: true } },
        installation: { select: { id: true, startsAt: true } },
        item: { include: { balances: { include: { location: true } } } },
        reservations: {
          where: { status: { in: ["ACTIVE", "PARTIALLY_ISSUED"] } },
          include: { balance: { include: { location: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.inventoryLocation.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
      select: { id: true, number: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.estimate.findMany({
      where: { status: { in: ["DRAFT", "FINAL"] } },
      select: { id: true, projectId: true, version: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.installation.findMany({
      where: { status: { notIn: ["COMPLETED"] } },
      select: { id: true, projectId: true, startsAt: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.purchaseOrderItem.findMany({
      where: {
        purchaseOrder: { status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] } },
      },
      select: { itemId: true, ordered: true, received: true },
    }),
  ]);
  const expected = new Map<string, number>();
  for (const row of expectedRows)
    expected.set(
      row.itemId,
      (expected.get(row.itemId) ?? 0) +
        Number(row.ordered) -
        Number(row.received),
    );
  const rows = requirements.map((req) => {
    const onHand = req.item.balances.reduce(
      (sum, b) => sum + Number(b.quantity),
      0,
    );
    const available = req.item.balances.reduce(
      (sum, b) => sum + Number(b.quantity) - Number(b.reserved),
      0,
    );
    const need = Math.max(
      0,
      Number(req.required) -
        Number(req.reserved) -
        Number(req.issued) -
        Number(req.consumed),
    );
    return {
      ...req,
      onHand,
      available,
      need,
      ...shortage(need, 0, available, expected.get(req.itemId) ?? 0),
      expected: expected.get(req.itemId) ?? 0,
    };
  });
  return {
    requirements: rows,
    locations,
    projects,
    estimates,
    installations,
    canManage: context.permissions.has(PERMISSIONS.INVENTORY_MANAGE),
  };
}

export async function getShortageReport() {
  await requirePermission(PERMISSIONS.INVENTORY_READ);
  const [items, requirements, orders] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      include: { balances: true },
    }),
    prisma.projectMaterialRequirement.groupBy({
      by: ["itemId"],
      where: { status: { notIn: ["CANCELLED", "USED", "WRITTEN_OFF"] } },
      _sum: { required: true, reserved: true, issued: true, consumed: true },
    }),
    prisma.purchaseOrderItem.findMany({
      where: {
        purchaseOrder: { status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] } },
      },
      include: { purchaseOrder: { include: { supplier: true } }, item: true },
    }),
  ]);
  const demand = new Map(
    requirements.map((row) => [
      row.itemId,
      Math.max(
        0,
        Number(row._sum.required ?? 0) -
          Number(row._sum.reserved ?? 0) -
          Number(row._sum.issued ?? 0) -
          Number(row._sum.consumed ?? 0),
      ),
    ]),
  );
  const expected = new Map<string, number>();
  for (const row of orders)
    expected.set(
      row.itemId,
      (expected.get(row.itemId) ?? 0) +
        Number(row.ordered) -
        Number(row.received),
    );
  const shortages = items
    .map((item) => {
      const quantity = item.balances.reduce(
        (s, b) => s + Number(b.quantity),
        0,
      );
      const reserved = item.balances.reduce(
        (s, b) => s + Number(b.reserved),
        0,
      );
      const available = quantity - reserved;
      const projectNeed = demand.get(item.id) ?? 0;
      const expectedQty = expected.get(item.id) ?? 0;
      const recommended = Math.max(
        0,
        Math.max(
          Number(item.minimumQuantity) - available,
          projectNeed - available,
        ) - expectedQty,
      );
      return {
        item,
        quantity,
        reserved,
        available,
        projectNeed,
        expected: expectedQty,
        recommended,
      };
    })
    .filter(
      (row) =>
        row.available < Number(row.item.minimumQuantity) ||
        row.projectNeed > row.available ||
        row.expected > 0,
    );
  return { shortages, orders };
}
