ALTER TABLE "users"
  ALTER COLUMN "email" DROP NOT NULL,
  ALTER COLUMN "login" TYPE VARCHAR(160);

CREATE UNIQUE INDEX "users_login_lower_key" ON "users" (LOWER("login"));