CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "announcements_createdAt_idx" ON "announcements"("createdAt" DESC);

ALTER TABLE "announcements"
ADD CONSTRAINT "announcements_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
