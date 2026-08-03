ALTER TABLE "users"
  ADD COLUMN "phone" VARCHAR(32),
  ADD COLUMN "phoneNormalized" VARCHAR(20);

CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE UNIQUE INDEX "users_phoneNormalized_key" ON "users"("phoneNormalized");