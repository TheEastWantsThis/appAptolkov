ALTER TABLE "Room" ADD COLUMN "reactionsEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "RoomModerationAudit" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "targetUserId" UUID,
    "targetMessageId" UUID,
    "action" VARCHAR(40) NOT NULL,
    "mutedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoomModerationAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramChatBindingRequest" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "requestId" INTEGER NOT NULL,
    "preparedButtonId" VARCHAR(256) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "message" VARCHAR(240),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramChatBindingRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramChatBindingRequest_requestId_key" ON "TelegramChatBindingRequest"("requestId");
CREATE INDEX "RoomModerationAudit_roomId_createdAt_id_idx" ON "RoomModerationAudit"("roomId", "createdAt", "id");
CREATE INDEX "RoomModerationAudit_expiresAt_idx" ON "RoomModerationAudit"("expiresAt");
CREATE INDEX "TelegramChatBindingRequest_roomId_requestedById_createdAt_idx" ON "TelegramChatBindingRequest"("roomId", "requestedById", "createdAt");
CREATE INDEX "TelegramChatBindingRequest_expiresAt_status_idx" ON "TelegramChatBindingRequest"("expiresAt", "status");

ALTER TABLE "RoomModerationAudit" ADD CONSTRAINT "RoomModerationAudit_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomModerationAudit" ADD CONSTRAINT "RoomModerationAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomModerationAudit" ADD CONSTRAINT "RoomModerationAudit_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelegramChatBindingRequest" ADD CONSTRAINT "TelegramChatBindingRequest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramChatBindingRequest" ADD CONSTRAINT "TelegramChatBindingRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
