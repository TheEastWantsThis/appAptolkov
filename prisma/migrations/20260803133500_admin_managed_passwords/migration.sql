-- Users cannot change their own password; existing forced-change flags are cleared.
UPDATE "users" SET "mustChangePassword" = false WHERE "mustChangePassword" = true;