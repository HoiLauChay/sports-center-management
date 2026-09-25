-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('PAYMENT', 'MEMBERSHIP', 'BOOKING', 'CLASS', 'TRAINING', 'SUPPORT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "support_request_category" AS ENUM ('ACCOUNT', 'MEMBERSHIP', 'BOOKING', 'CLASS', 'PAYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "support_request_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "reference_type" VARCHAR(50),
    "reference_id" UUID,
    "dedup_key" VARCHAR(150),
    "read_at" TIMESTAMPTZ,
    "send_email" BOOLEAN NOT NULL DEFAULT false,
    "email_sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "handled_by" UUID,
    "category" "support_request_category" NOT NULL DEFAULT 'OTHER',
    "subject" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "resolution_note" TEXT,
    "status" "support_request_status" NOT NULL DEFAULT 'OPEN',
    "resolved_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "open_time" TIME NOT NULL DEFAULT '06:00:00'::time,
    "close_time" TIME NOT NULL DEFAULT '22:00:00'::time,
    "slot_duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "max_advance_booking_days" INTEGER NOT NULL DEFAULT 7,
    "booking_cancel_deadline_hours" INTEGER NOT NULL DEFAULT 24,
    "course_cancel_deadline_days" INTEGER NOT NULL DEFAULT 3,
    "membership_expiry_warning_days" INTEGER NOT NULL DEFAULT 7,
    "top_up_min_amount" DECIMAL(12,0) NOT NULL DEFAULT 10000,
    "top_up_expiry_minutes" INTEGER NOT NULL DEFAULT 30,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedup_key_key" ON "notifications"("dedup_key");

-- CreateIndex
CREATE INDEX "idx_noti_account_date" ON "notifications"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_noti_account_read" ON "notifications"("account_id", "read_at");

-- CreateIndex
CREATE INDEX "idx_noti_date" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "idx_audit_entity_date" ON "audit_logs"("entity_type", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_account_date" ON "audit_logs"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_sr_account_status" ON "support_requests"("account_id", "status");

-- CreateIndex
CREATE INDEX "idx_sr_status_date" ON "support_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed
INSERT INTO "system_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
