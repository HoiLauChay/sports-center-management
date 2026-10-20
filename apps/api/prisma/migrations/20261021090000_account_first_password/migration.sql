ALTER TYPE "otp_purpose" ADD VALUE 'ACCOUNT_SETUP';
ALTER TABLE "accounts" ADD COLUMN "must_set_password" BOOLEAN NOT NULL DEFAULT false;
UPDATE "accounts" SET "must_set_password" = true WHERE "email_verified_at" IS NULL;
