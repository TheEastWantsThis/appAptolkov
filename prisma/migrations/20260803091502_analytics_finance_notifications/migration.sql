-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'INSTALLMENTS', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_LEAD', 'OVERDUE_CALL', 'MEASUREMENT_TOMORROW', 'INSTALLATION_TOMORROW', 'ASSIGNMENT', 'STATUS_CHANGED', 'MATERIAL_SHORTAGE', 'PAYMENT_OVERDUE', 'REPEAT_VISIT');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('RECEIPT', 'CONSUMPTION', 'RESERVATION', 'RELEASE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "project_finances" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "contractAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "prepayment" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "additionalPayments" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "materialCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "installerWages" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "transportCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "additionalExpenses" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grossProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "marginPercent" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "paymentDueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_finances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "href" VARCHAR(500),
    "dedupeKey" VARCHAR(255),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "unit" VARCHAR(32) NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "minimumQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantityDelta" DECIMAL(14,3) NOT NULL,
    "reservedDelta" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "quantityAfter" DECIMAL(14,3) NOT NULL,
    "reservedAfter" DECIMAL(14,3) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_finances_projectId_key" ON "project_finances"("projectId");

-- CreateIndex
CREATE INDEX "project_finances_paymentDueAt_paidAt_idx" ON "project_finances"("paymentDueAt", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_createdAt_idx" ON "notifications"("userId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_code_key" ON "inventory_items"("code");

-- CreateIndex
CREATE INDEX "inventory_items_isActive_name_idx" ON "inventory_items"("isActive", "name");

-- CreateIndex
CREATE INDEX "stock_movements_itemId_createdAt_idx" ON "stock_movements"("itemId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "stock_movements_actorId_createdAt_idx" ON "stock_movements"("actorId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "project_finances" ADD CONSTRAINT "project_finances_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_finances" ADD CONSTRAINT "project_finances_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
