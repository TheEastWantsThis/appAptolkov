ALTER TABLE "AbuseReport"
ADD COLUMN "status" VARCHAR(16) NOT NULL DEFAULT 'OPEN',
ADD COLUMN "resolution" VARCHAR(240),
ADD COLUMN "reviewedAt" TIMESTAMP(3);

ALTER TABLE "AbuseReport"
ADD CONSTRAINT "AbuseReport_status_check"
CHECK ("status" IN ('OPEN', 'RESOLVED', 'DISMISSED'));

CREATE INDEX "AbuseReport_status_createdAt_id_idx"
ON "AbuseReport"("status", "createdAt", "id");
