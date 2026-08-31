ALTER TABLE "Room"
ADD COLUMN "playbackState" VARCHAR(16) NOT NULL DEFAULT 'PAUSED',
ADD COLUMN "playbackRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN "playbackActorUserId" UUID,
ADD COLUMN "playbackLiveEdge" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Room"
ADD CONSTRAINT "Room_playback_state_check" CHECK ("playbackState" IN ('PLAYING', 'PAUSED', 'ENDED')),
ADD CONSTRAINT "Room_playback_rate_check" CHECK ("playbackRate" = 1);

DROP INDEX "RoomMessage_roomId_createdAt_idx";
CREATE INDEX "RoomMessage_roomId_createdAt_id_idx" ON "RoomMessage"("roomId", "createdAt", "id");
