-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('PROMOTER', 'WEBSITE', 'PHONE', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'CONTACTED', 'QUALIFIED', 'DECLINED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "HousingType" AS ENUM ('APARTMENT', 'HOUSE', 'COMMERCIAL', 'NEW_BUILD', 'OTHER');

-- CreateEnum
CREATE TYPE "CallResult" AS ENUM ('NO_ANSWER', 'CALLBACK', 'INTERESTED', 'MEASUREMENT', 'DECLINED', 'WRONG_NUMBER');

-- CreateEnum
CREATE TYPE "WorkTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkTaskType" AS ENUM ('CALL', 'FOLLOW_UP', 'MEASUREMENT', 'GENERAL');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('QUALIFIED', 'MEASUREMENT_SCHEDULED', 'MEASURED', 'ESTIMATE_PREPARATION', 'CONTRACT_PENDING', 'CONTRACT_SIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('CALL', 'MEASUREMENT', 'MEETING', 'INSTALLATION', 'DEADLINE', 'OTHER');

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "clientName" VARCHAR(160),
    "phone" VARCHAR(32) NOT NULL,
    "phoneNormalized" VARCHAR(20) NOT NULL,
    "districtOrAddress" VARCHAR(500),
    "housingType" "HousingType",
    "roomsApprox" INTEGER,
    "repairTimeline" VARCHAR(160),
    "preferredCallTime" VARCHAR(160),
    "comment" VARCHAR(2000),
    "adPoint" VARCHAR(200),
    "contactConsent" BOOLEAN NOT NULL,
    "source" "LeadSource" NOT NULL DEFAULT 'PROMOTER',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "declineReason" VARCHAR(500),
    "measurementAt" TIMESTAMP(3),
    "authorId" UUID NOT NULL,
    "operatorId" UUID,
    "measurerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "qualifiedAt" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_logs" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "result" "CallResult" NOT NULL,
    "note" VARCHAR(2000),
    "nextContactAt" TIMESTAMP(3),
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "phoneNormalized" VARCHAR(20) NOT NULL,
    "address" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "number" VARCHAR(32) NOT NULL,
    "customerId" UUID NOT NULL,
    "leadId" UUID,
    "source" "LeadSource" NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'QUALIFIED',
    "address" VARCHAR(500) NOT NULL,
    "description" VARCHAR(2000),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_tasks" (
    "id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" VARCHAR(2000),
    "type" "WorkTaskType" NOT NULL DEFAULT 'GENERAL',
    "status" "WorkTaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "leadId" UUID,
    "projectId" UUID,
    "assigneeId" UUID,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_responsibles" (
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleLabel" VARCHAR(100) NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_responsibles_pkey" PRIMARY KEY ("projectId","userId","roleLabel")
);

-- CreateTable
CREATE TABLE "project_comments" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" VARCHAR(3000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_files" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_status_history" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "fromStatus" "ProjectStatus",
    "toStatus" "ProjectStatus" NOT NULL,
    "changedById" UUID NOT NULL,
    "comment" VARCHAR(1000),
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_assignment_history" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID,
    "roleLabel" VARCHAR(100) NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "changedById" UUID NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "assigneeId" UUID,
    "type" "CalendarEventType" NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "note" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_rooms" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "area" DECIMAL(10,2),
    "description" VARCHAR(1000),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_phoneNormalized_key" ON "leads"("phoneNormalized");

-- CreateIndex
CREATE INDEX "leads_status_createdAt_idx" ON "leads"("status", "createdAt");

-- CreateIndex
CREATE INDEX "leads_authorId_createdAt_idx" ON "leads"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "leads_operatorId_status_idx" ON "leads"("operatorId", "status");

-- CreateIndex
CREATE INDEX "call_logs_leadId_calledAt_idx" ON "call_logs"("leadId", "calledAt" DESC);

-- CreateIndex
CREATE INDEX "call_logs_nextContactAt_idx" ON "call_logs"("nextContactAt");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phoneNormalized_key" ON "customers"("phoneNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "projects_number_key" ON "projects"("number");

-- CreateIndex
CREATE UNIQUE INDEX "projects_leadId_key" ON "projects"("leadId");

-- CreateIndex
CREATE INDEX "projects_status_updatedAt_idx" ON "projects"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "projects_customerId_idx" ON "projects"("customerId");

-- CreateIndex
CREATE INDEX "work_tasks_assigneeId_status_dueAt_idx" ON "work_tasks"("assigneeId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "work_tasks_leadId_idx" ON "work_tasks"("leadId");

-- CreateIndex
CREATE INDEX "work_tasks_projectId_idx" ON "work_tasks"("projectId");

-- CreateIndex
CREATE INDEX "project_responsibles_userId_idx" ON "project_responsibles"("userId");

-- CreateIndex
CREATE INDEX "project_comments_projectId_createdAt_idx" ON "project_comments"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "project_files_projectId_createdAt_idx" ON "project_files"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "project_status_history_projectId_changedAt_idx" ON "project_status_history"("projectId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "project_assignment_history_projectId_changedAt_idx" ON "project_assignment_history"("projectId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "calendar_events_projectId_startsAt_idx" ON "calendar_events"("projectId", "startsAt");

-- CreateIndex
CREATE INDEX "calendar_events_assigneeId_startsAt_idx" ON "calendar_events"("assigneeId", "startsAt");

-- CreateIndex
CREATE INDEX "project_rooms_projectId_sortOrder_idx" ON "project_rooms"("projectId", "sortOrder");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_measurerId_fkey" FOREIGN KEY ("measurerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_responsibles" ADD CONSTRAINT "project_responsibles_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_responsibles" ADD CONSTRAINT "project_responsibles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_status_history" ADD CONSTRAINT "project_status_history_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_status_history" ADD CONSTRAINT "project_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignment_history" ADD CONSTRAINT "project_assignment_history_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignment_history" ADD CONSTRAINT "project_assignment_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignment_history" ADD CONSTRAINT "project_assignment_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_rooms" ADD CONSTRAINT "project_rooms_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
