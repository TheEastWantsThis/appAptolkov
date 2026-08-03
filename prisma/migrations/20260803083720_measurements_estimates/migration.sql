-- CreateEnum
CREATE TYPE "MeasurementStatus" AS ENUM ('SCHEDULED', 'DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AreaCalculationMode" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "RoomMediaType" AS ENUM ('PHOTO', 'DRAWING');

-- CreateEnum
CREATE TYPE "TariffUnit" AS ENUM ('M2', 'M', 'PCS', 'FIXED', 'ZONE', 'COEFFICIENT');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'FINAL', 'CANCELLED');

-- AlterTable
ALTER TABLE "project_rooms" ADD COLUMN     "additionalWorkUnits" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "additionalWorks" VARCHAR(2000),
ADD COLUMN     "areaMode" "AreaCalculationMode" NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "cabinetBypass" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "canvasType" VARCHAR(100),
ADD COLUMN     "chandeliers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "color" VARCHAR(100),
ADD COLUMN     "comment" VARCHAR(2000),
ADD COLUMN     "complexityCoefficient" DECIMAL(6,3) NOT NULL DEFAULT 1,
ADD COLUMN     "corners" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "cornices" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "height" DECIMAL(10,2),
ADD COLUMN     "insertLength" DECIMAL(10,2),
ADD COLUMN     "length" DECIMAL(10,2),
ADD COLUMN     "lights" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "manufacturer" VARCHAR(120),
ADD COLUMN     "measurementId" UUID,
ADD COLUMN     "niches" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "perimeter" DECIMAL(10,2),
ADD COLUMN     "pipes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "profileLength" DECIMAL(10,2),
ADD COLUMN     "profileType" VARCHAR(100),
ADD COLUMN     "sensors" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "texture" VARCHAR(100),
ADD COLUMN     "tracks" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "ventilation" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "width" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "measurements" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "measurerId" UUID NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "district" VARCHAR(160),
    "objectType" VARCHAR(120),
    "operatorComment" VARCHAR(2000),
    "requiredDocuments" TEXT[],
    "status" "MeasurementStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startedAt" TIMESTAMP(3),
    "draftSavedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_room_media" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "type" "RoomMediaType" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_room_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariffs" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "unit" "TariffUnit" NOT NULL,
    "internalPrice" DECIMAL(12,2) NOT NULL,
    "clientPrice" DECIMAL(12,2) NOT NULL,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "measurementId" UUID,
    "version" INTEGER NOT NULL,
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" UUID NOT NULL,
    "tariffSnapshot" JSONB NOT NULL,
    "discountPercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "subtotalInternal" DECIMAL(14,2) NOT NULL,
    "subtotalClient" DECIMAL(14,2) NOT NULL,
    "discountAmount" DECIMAL(14,2) NOT NULL,
    "totalInternal" DECIMAL(14,2) NOT NULL,
    "totalClient" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_lines" (
    "id" UUID NOT NULL,
    "estimateId" UUID NOT NULL,
    "roomId" UUID,
    "code" VARCHAR(100) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" "TariffUnit" NOT NULL,
    "internalUnitPrice" DECIMAL(12,2) NOT NULL,
    "clientUnitPrice" DECIMAL(12,2) NOT NULL,
    "internalAmount" DECIMAL(14,2) NOT NULL,
    "clientAmount" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "estimate_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "measurements_measurerId_scheduledAt_idx" ON "measurements"("measurerId", "scheduledAt");

-- CreateIndex
CREATE INDEX "measurements_projectId_status_idx" ON "measurements"("projectId", "status");

-- CreateIndex
CREATE INDEX "project_room_media_roomId_type_idx" ON "project_room_media"("roomId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "tariffs_code_key" ON "tariffs"("code");

-- CreateIndex
CREATE INDEX "tariffs_category_isActive_idx" ON "tariffs"("category", "isActive");

-- CreateIndex
CREATE INDEX "estimates_measurementId_idx" ON "estimates"("measurementId");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_projectId_version_key" ON "estimates"("projectId", "version");

-- CreateIndex
CREATE INDEX "estimate_lines_estimateId_sortOrder_idx" ON "estimate_lines"("estimateId", "sortOrder");

-- CreateIndex
CREATE INDEX "estimate_lines_roomId_idx" ON "estimate_lines"("roomId");

-- CreateIndex
CREATE INDEX "project_rooms_measurementId_idx" ON "project_rooms"("measurementId");

-- AddForeignKey
ALTER TABLE "project_rooms" ADD CONSTRAINT "project_rooms_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "measurements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_measurerId_fkey" FOREIGN KEY ("measurerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_room_media" ADD CONSTRAINT "project_room_media_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "project_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_room_media" ADD CONSTRAINT "project_room_media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "measurements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "project_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
