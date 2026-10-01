-- CreateEnum
CREATE TYPE "invoice_purpose" AS ENUM ('WALLET_TOP_UP', 'COUNTER_ORDER');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'FAILED');

-- DropTable
DROP TABLE "wallet_top_ups";

-- DropEnum
DROP TYPE "top_up_status";

-- AlterTable
ALTER TABLE "orders" RENAME COLUMN "invoice_snapshot" TO "receipt_snapshot";

-- AlterTable
ALTER TABLE "system_settings" RENAME COLUMN "top_up_expiry_minutes" TO "invoice_expiry_minutes";
ALTER TABLE "system_settings" ALTER COLUMN "invoice_expiry_minutes" SET DEFAULT 15;
UPDATE "system_settings" SET "invoice_expiry_minutes" = 15 WHERE "invoice_expiry_minutes" = 30;
ALTER TABLE "system_settings" RENAME CONSTRAINT "ck_settings_top_up" TO "ck_settings_payment";

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_code" VARCHAR(20) NOT NULL,
    "purpose" "invoice_purpose" NOT NULL,
    "account_id" UUID,
    "guest_name" VARCHAR(255),
    "guest_phone" VARCHAR(20),
    "amount" DECIMAL(12,0) NOT NULL,
    "request_payload" JSONB,
    "status" "invoice_status" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "bank_transaction_id" UUID,
    "order_id" UUID,
    "paid_at" TIMESTAMPTZ,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_payment_code_key" ON "invoices"("payment_code");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_bank_transaction_id_key" ON "invoices"("bank_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_order_id_key" ON "invoices"("order_id");

-- CreateIndex
CREATE INDEX "idx_invoices_account_date" ON "invoices"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_invoices_status_expires" ON "invoices"("status", "expires_at");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "member_profile"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "ck_invoices_amount" CHECK (amount > 0);
ALTER TABLE "invoices" ADD CONSTRAINT "ck_invoices_purpose" CHECK ((purpose = 'WALLET_TOP_UP' AND account_id IS NOT NULL AND guest_name IS NULL AND guest_phone IS NULL AND request_payload IS NULL) OR (purpose = 'COUNTER_ORDER' AND request_payload IS NOT NULL AND ((account_id IS NOT NULL AND guest_name IS NULL AND guest_phone IS NULL) OR (account_id IS NULL AND length(btrim(coalesce(guest_name, ''))) > 0 AND length(btrim(coalesce(guest_phone, ''))) > 0))));
ALTER TABLE "invoices" ADD CONSTRAINT "ck_invoices_status_purpose" CHECK (purpose = 'COUNTER_ORDER' OR status NOT IN ('CANCELLED', 'FAILED'));
ALTER TABLE "invoices" ADD CONSTRAINT "ck_invoices_paid" CHECK ((status IN ('PAID', 'FAILED')) = (bank_transaction_id IS NOT NULL AND paid_at IS NOT NULL));
ALTER TABLE "invoices" ADD CONSTRAINT "ck_invoices_order" CHECK ((purpose = 'COUNTER_ORDER' AND status = 'PAID') = (order_id IS NOT NULL));
