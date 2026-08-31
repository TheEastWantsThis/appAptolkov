CREATE TABLE "RoomUserBlock" (
    "roomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "blockedById" UUID NOT NULL,
    "reason" VARCHAR(240),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomUserBlock_pkey" PRIMARY KEY ("roomId", "userId")
);

CREATE TABLE "AbuseReport" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "targetUserId" UUID,
    "category" VARCHAR(32) NOT NULL,
    "details" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AbuseReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoomUserBlock_userId_idx" ON "RoomUserBlock"("userId");
CREATE INDEX "AbuseReport_roomId_createdAt_idx" ON "AbuseReport"("roomId", "createdAt");
CREATE INDEX "AbuseReport_reporterId_createdAt_idx" ON "AbuseReport"("reporterId", "createdAt");
CREATE INDEX "AbuseReport_expiresAt_idx" ON "AbuseReport"("expiresAt");

ALTER TABLE "RoomUserBlock" ADD CONSTRAINT "RoomUserBlock_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomUserBlock" ADD CONSTRAINT "RoomUserBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomUserBlock" ADD CONSTRAINT "RoomUserBlock_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AbuseReport" ADD CONSTRAINT "AbuseReport_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AbuseReport" ADD CONSTRAINT "AbuseReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AbuseReport" ADD CONSTRAINT "AbuseReport_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
