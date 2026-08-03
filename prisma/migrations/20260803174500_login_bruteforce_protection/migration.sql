ALTER TABLE "users"
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "loginLockedUntil" TIMESTAMP(3);

CREATE INDEX "users_loginLockedUntil_idx" ON "users"("loginLockedUntil");