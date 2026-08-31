CREATE TYPE "RoomVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE "RoomStatus" AS ENUM ('DRAFT', 'WAITING', 'LIVE', 'ENDED');
CREATE TYPE "RoomControlPolicy" AS ENUM ('OWNER_ONLY', 'MODERATORS', 'EVERYONE');
CREATE TYPE "SourceProvider" AS ENUM ('YOUTUBE', 'TWITCH');
CREATE TYPE "SourceKind" AS ENUM ('VIDEO', 'VOD', 'LIVE');
CREATE TYPE "RoomRole" AS ENUM ('OWNER', 'MODERATOR', 'VIEWER');

CREATE TABLE "Room" (
  "id" UUID NOT NULL,
  "publicId" VARCHAR(24) NOT NULL,
  "channelId" UUID NOT NULL,
  "ownerId" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "description" VARCHAR(240) NOT NULL DEFAULT '',
  "visibility" "RoomVisibility" NOT NULL DEFAULT 'PUBLIC',
  "passwordHash" VARCHAR(255),
  "passwordRevision" INTEGER NOT NULL DEFAULT 1,
  "status" "RoomStatus" NOT NULL DEFAULT 'DRAFT',
  "controlPolicy" "RoomControlPolicy" NOT NULL DEFAULT 'OWNER_ONLY',
  "sourceProvider" "SourceProvider" NOT NULL,
  "sourceKind" "SourceKind" NOT NULL,
  "sourceId" VARCHAR(128) NOT NULL,
  "canonicalUrl" VARCHAR(2048) NOT NULL,
  "cachedTitle" VARCHAR(200),
  "cachedThumbnailUrl" VARCHAR(2048),
  "cachedCreatorName" VARCHAR(120),
  "nowWatchingText" VARCHAR(120) NOT NULL DEFAULT '',
  "playbackPaused" BOOLEAN NOT NULL DEFAULT true,
  "playbackPositionSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "playbackVersion" INTEGER NOT NULL DEFAULT 0,
  "playbackUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "linkedTelegramChatId" BIGINT,
  "linkedTelegramChatUsername" VARCHAR(32),
  "linkedTelegramChatUrl" VARCHAR(2048),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Room_password_visibility_check" CHECK (
    ("visibility" = 'PRIVATE' AND "passwordHash" IS NOT NULL) OR
    ("visibility" = 'PUBLIC' AND "passwordHash" IS NULL)
  ),
  CONSTRAINT "Room_playback_position_check" CHECK ("playbackPositionSeconds" >= 0),
  CONSTRAINT "Room_playback_version_check" CHECK ("playbackVersion" >= 0)
);

CREATE TABLE "RoomMember" (
  "roomId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "RoomRole" NOT NULL DEFAULT 'VIEWER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("roomId", "userId")
);

CREATE TABLE "RoomAccessGrant" (
  "id" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "roomId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "passwordRevision" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomMessage" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "authorId" UUID NOT NULL,
  "text" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoomMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomChatRestriction" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "mutedById" UUID NOT NULL,
  "reason" VARCHAR(240),
  "mutedUntil" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomChatRestriction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Room_publicId_key" ON "Room"("publicId");
CREATE INDEX "Room_visibility_status_updatedAt_id_idx" ON "Room"("visibility", "status", "updatedAt", "id");
CREATE INDEX "Room_channelId_status_updatedAt_id_idx" ON "Room"("channelId", "status", "updatedAt", "id");
CREATE INDEX "Room_ownerId_idx" ON "Room"("ownerId");
CREATE INDEX "RoomMember_userId_idx" ON "RoomMember"("userId");
CREATE UNIQUE INDEX "RoomAccessGrant_tokenHash_key" ON "RoomAccessGrant"("tokenHash");
CREATE INDEX "RoomAccessGrant_roomId_userId_expiresAt_idx" ON "RoomAccessGrant"("roomId", "userId", "expiresAt");
CREATE INDEX "RoomAccessGrant_expiresAt_idx" ON "RoomAccessGrant"("expiresAt");
CREATE INDEX "RoomMessage_roomId_createdAt_idx" ON "RoomMessage"("roomId", "createdAt");
CREATE INDEX "RoomMessage_expiresAt_idx" ON "RoomMessage"("expiresAt");
CREATE INDEX "RoomChatRestriction_roomId_userId_mutedUntil_idx" ON "RoomChatRestriction"("roomId", "userId", "mutedUntil");
CREATE INDEX "RoomChatRestriction_mutedUntil_idx" ON "RoomChatRestriction"("mutedUntil");

ALTER TABLE "Room" ADD CONSTRAINT "Room_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomAccessGrant" ADD CONSTRAINT "RoomAccessGrant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomAccessGrant" ADD CONSTRAINT "RoomAccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomChatRestriction" ADD CONSTRAINT "RoomChatRestriction_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomChatRestriction" ADD CONSTRAINT "RoomChatRestriction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomChatRestriction" ADD CONSTRAINT "RoomChatRestriction_mutedById_fkey" FOREIGN KEY ("mutedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
