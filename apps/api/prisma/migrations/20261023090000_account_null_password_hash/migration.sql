ALTER TABLE "accounts" ALTER COLUMN "password_hash" DROP NOT NULL;
UPDATE "accounts" SET "password_hash" = NULL WHERE "must_set_password";
ALTER TABLE "accounts" DROP COLUMN "must_set_password";
