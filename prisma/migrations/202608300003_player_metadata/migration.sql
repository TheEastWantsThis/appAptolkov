ALTER TABLE "Room"
ADD COLUMN "cachedLiveStatus" VARCHAR(16),
ADD COLUMN "cachedEmbeddable" BOOLEAN,
ADD COLUMN "metadataFetchedAt" TIMESTAMP(3);

CREATE INDEX "Room_metadataFetchedAt_idx" ON "Room"("metadataFetchedAt");
