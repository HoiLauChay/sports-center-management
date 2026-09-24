-- CreateEnum
CREATE TYPE "role" AS ENUM ('MANAGER', 'COACH', 'MEMBER', 'RECEPTIONIST');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('ACTIVE', 'INACTIVE', 'BANNED');

-- CreateEnum
CREATE TYPE "gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "otp_purpose" AS ENUM ('REGISTER', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "avatar_url" TEXT,
    "role" "role" NOT NULL DEFAULT 'MEMBER',
    "status" "account_status" NOT NULL DEFAULT 'ACTIVE',
    "email_verified_at" TIMESTAMPTZ,
    "password_changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_of_birth" DATE,
    "gender" "gender",
    "address" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_profile" (
    "account_id" UUID NOT NULL,
    "emergency_contact" VARCHAR(255),
    "fitness_goals" TEXT,
    "health_notes" TEXT,
    "wallet_balance" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_profile_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "coach_profile" (
    "account_id" UUID NOT NULL,
    "bio" TEXT,
    "experience" TEXT,
    "certifications" TEXT,
    "cover_image_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_profile_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "receptionist_profile" (
    "account_id" UUID NOT NULL,
    "staff_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receptionist_profile_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "manager_profile" (
    "account_id" UUID NOT NULL,
    "staff_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manager_profile_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "user_agent" VARCHAR(500),
    "ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "purpose" "otp_purpose" NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_phone_key" ON "accounts"("phone");

-- CreateIndex
CREATE INDEX "idx_accounts_role_status" ON "accounts"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_account" ON "refresh_tokens"("account_id");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_expires" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_otp_email_purpose" ON "otp_codes"("email", "purpose");

-- AddForeignKey
ALTER TABLE "member_profile" ADD CONSTRAINT "member_profile_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_profile" ADD CONSTRAINT "coach_profile_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receptionist_profile" ADD CONSTRAINT "receptionist_profile_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_profile" ADD CONSTRAINT "manager_profile_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "member_profile" ADD CONSTRAINT "ck_member_profile_wallet" CHECK ("wallet_balance" >= 0);

ALTER TABLE "otp_codes" ADD CONSTRAINT "ck_otp_attempts" CHECK ("attempts" >= 0);
