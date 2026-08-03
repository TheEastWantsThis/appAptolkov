/*
  Warnings:

  - Added the required column `quantity` to the `stock_movements` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantityBefore` to the `stock_movements` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reservedBefore` to the `stock_movements` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProjectMaterialStatus" AS ENUM ('PLANNED', 'PREPARED', 'PARTIALLY_ISSUED', 'ISSUED', 'PARTIALLY_RETURNED', 'RETURNED', 'USED', 'WRITTEN_OFF', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVE', 'PARTIALLY_ISSUED', 'ISSUED', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryMovementType" ADD VALUE 'ISSUE';
ALTER TYPE "InventoryMovementType" ADD VALUE 'RETURN';
ALTER TYPE "InventoryMovementType" ADD VALUE 'WRITE_OFF';
ALTER TYPE "InventoryMovementType" ADD VALUE 'TRANSFER';

-- DropIndex
DROP INDEX "inventory_items_isActive_name_idx";

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "categoryId" UUID,
ADD COLUMN     "defaultLocationId" UUID,
ADD COLUMN     "purchasePrice" DECIMAL(14,2),
ADD COLUMN     "unitId" UUID;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "destinationQuantityAfter" DECIMAL(14,3),
ADD COLUMN     "destinationQuantityBefore" DECIMAL(14,3),
ADD COLUMN     "documentRef" VARCHAR(255),
ADD COLUMN     "fromLocationId" UUID,
ADD COLUMN     "installationId" UUID,
ADD COLUMN     "projectId" UUID,
ADD COLUMN     "quantity" DECIMAL(14,3) NOT NULL,
ADD COLUMN     "quantityBefore" DECIMAL(14,3) NOT NULL,
ADD COLUMN     "requirementId" UUID,
ADD COLUMN     "reservationId" UUID,
ADD COLUMN     "reservedBefore" DECIMAL(14,3) NOT NULL,
ADD COLUMN     "toLocationId" UUID;

-- CreateTable
CREATE TABLE "inventory_categories" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "parentId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_units" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "symbol" VARCHAR(32) NOT NULL,
    "precision" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "inventory_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_locations" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "address" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "contactPerson" VARCHAR(160),
    "phone" VARCHAR(32),
    "email" VARCHAR(254),
    "comment" VARCHAR(1000),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_prices" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'RUB',
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),

    CONSTRAINT "supplier_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_material_requirements" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "roomId" UUID,
    "estimateId" UUID,
    "installationId" UUID,
    "itemId" UUID NOT NULL,
    "required" DECIMAL(14,3) NOT NULL,
    "reserved" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "issued" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "consumed" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "returned" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "writtenOff" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "status" "ProjectMaterialStatus" NOT NULL DEFAULT 'PLANNED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_material_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" UUID NOT NULL,
    "requirementId" UUID NOT NULL,
    "balanceId" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "issued" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "released" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "status" "StockReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reservedById" UUID NOT NULL,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "inventoryLocationId" UUID,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "number" VARCHAR(64) NOT NULL,
    "supplierId" UUID NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "expectedAt" TIMESTAMP(3),
    "documentRef" VARCHAR(255),
    "comment" VARCHAR(1000),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "ordered" DECIMAL(14,3) NOT NULL,
    "received" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_categories_code_key" ON "inventory_categories"("code");

-- CreateIndex
CREATE INDEX "inventory_categories_parentId_isActive_idx" ON "inventory_categories"("parentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_units_code_key" ON "inventory_units"("code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_locations_code_key" ON "inventory_locations"("code");

-- CreateIndex
CREATE INDEX "inventory_locations_isActive_name_idx" ON "inventory_locations"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "suppliers_isActive_name_idx" ON "suppliers"("isActive", "name");

-- CreateIndex
CREATE INDEX "supplier_prices_itemId_validFrom_idx" ON "supplier_prices"("itemId", "validFrom" DESC);

-- CreateIndex
CREATE INDEX "inventory_balances_locationId_itemId_idx" ON "inventory_balances"("locationId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_itemId_locationId_key" ON "inventory_balances"("itemId", "locationId");

-- CreateIndex
CREATE INDEX "project_material_requirements_projectId_status_idx" ON "project_material_requirements"("projectId", "status");

-- CreateIndex
CREATE INDEX "project_material_requirements_itemId_status_idx" ON "project_material_requirements"("itemId", "status");

-- CreateIndex
CREATE INDEX "project_material_requirements_installationId_status_idx" ON "project_material_requirements"("installationId", "status");

-- CreateIndex
CREATE INDEX "stock_reservations_requirementId_status_idx" ON "stock_reservations"("requirementId", "status");

-- CreateIndex
CREATE INDEX "stock_reservations_balanceId_status_idx" ON "stock_reservations"("balanceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_number_key" ON "purchase_orders"("number");

-- CreateIndex
CREATE INDEX "purchase_orders_status_expectedAt_idx" ON "purchase_orders"("status", "expectedAt");

-- CreateIndex
CREATE INDEX "purchase_order_items_itemId_idx" ON "purchase_order_items"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_items_purchaseOrderId_itemId_key" ON "purchase_order_items"("purchaseOrderId", "itemId");

-- CreateIndex
CREATE INDEX "inventory_items_isActive_archivedAt_name_idx" ON "inventory_items"("isActive", "archivedAt", "name");

-- CreateIndex
CREATE INDEX "stock_movements_projectId_createdAt_idx" ON "stock_movements"("projectId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "inventory_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_prices" ADD CONSTRAINT "supplier_prices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_prices" ADD CONSTRAINT "supplier_prices_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "inventory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "inventory_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_defaultLocationId_fkey" FOREIGN KEY ("defaultLocationId") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_material_requirements" ADD CONSTRAINT "project_material_requirements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_material_requirements" ADD CONSTRAINT "project_material_requirements_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "project_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_material_requirements" ADD CONSTRAINT "project_material_requirements_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_material_requirements" ADD CONSTRAINT "project_material_requirements_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "installations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_material_requirements" ADD CONSTRAINT "project_material_requirements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "project_material_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "inventory_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_reservedById_fkey" FOREIGN KEY ("reservedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_inventoryLocationId_fkey" FOREIGN KEY ("inventoryLocationId") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "installations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "project_material_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "stock_reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
