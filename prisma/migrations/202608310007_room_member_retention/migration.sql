ALTER TABLE "RoomMember"
ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "RoomMember_roomId_lastSeenAt_userId_idx"
ON "RoomMember"("roomId", "lastSeenAt", "userId");
