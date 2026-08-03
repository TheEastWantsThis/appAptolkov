-- CreateEnum
CREATE TYPE "InstallationStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'MATERIALS_RECEIVED', 'EN_ROUTE', 'STARTED', 'PAUSED', 'COMPLETED', 'REPEAT_REQUIRED');

-- CreateEnum
CREATE TYPE "InstallationMediaType" AS ENUM ('BEFORE', 'PROCESS', 'AFTER');

-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN     "installationId" UUID;

-- CreateTable
CREATE TABLE "installations" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "vehicle" VARCHAR(200),
    "schedulerComment" VARCHAR(2000),
    "plannedMaterials" TEXT[],
    "plannedTools" TEXT[],
    "technicalBrief" VARCHAR(5000) NOT NULL,
    "specialConditions" VARCHAR(2000),
    "crewComment" VARCHAR(2000),
    "status" "InstallationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "actualStartedAt" TIMESTAMP(3),
    "actualEndedAt" TIMESTAMP(3),
    "workComment" VARCHAR(3000),
    "issues" VARCHAR(3000),
    "responsibleSignature" VARCHAR(1000),
    "acceptedAt" TIMESTAMP(3),
    "parentInstallationId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installation_participants" (
    "installationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "isForeman" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installation_participants_pkey" PRIMARY KEY ("installationId","userId")
);

-- CreateTable
CREATE TABLE "installation_media" (
    "id" UUID NOT NULL,
    "installationId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "type" "InstallationMediaType" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installation_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installation_material_usage" (
    "id" UUID NOT NULL,
    "installationId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" VARCHAR(32) NOT NULL,

    CONSTRAINT "installation_material_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "installations_projectId_startsAt_idx" ON "installations"("projectId", "startsAt");

-- CreateIndex
CREATE INDEX "installations_status_startsAt_idx" ON "installations"("status", "startsAt");

-- CreateIndex
CREATE INDEX "installations_parentInstallationId_idx" ON "installations"("parentInstallationId");

-- CreateIndex
CREATE INDEX "installation_participants_userId_idx" ON "installation_participants"("userId");

-- CreateIndex
CREATE INDEX "installation_media_installationId_type_idx" ON "installation_media"("installationId", "type");

-- CreateIndex
CREATE INDEX "installation_material_usage_installationId_idx" ON "installation_material_usage"("installationId");

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installations" ADD CONSTRAINT "installations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installations" ADD CONSTRAINT "installations_parentInstallationId_fkey" FOREIGN KEY ("parentInstallationId") REFERENCES "installations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_participants" ADD CONSTRAINT "installation_participants_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_participants" ADD CONSTRAINT "installation_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_media" ADD CONSTRAINT "installation_media_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_media" ADD CONSTRAINT "installation_media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_material_usage" ADD CONSTRAINT "installation_material_usage_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
