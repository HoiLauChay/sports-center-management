-- CreateEnum
CREATE TYPE "membership_status" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "transaction_type" AS ENUM ('TOP_UP', 'PAYMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "top_up_status" AS ENUM ('PENDING', 'SUCCESS', 'EXPIRED');

-- CreateEnum
CREATE TYPE "bank_transaction_status" AS ENUM ('MATCHED', 'UNMATCHED', 'RESOLVED', 'IGNORED');

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,0) NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "gym_access" BOOLEAN NOT NULL DEFAULT false,
    "booking_discount_pct" INTEGER NOT NULL DEFAULT 0,
    "class_discount_pct" INTEGER NOT NULL DEFAULT 0,
    "free_booking_slots_per_month" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "status" "membership_status" NOT NULL DEFAULT 'ACTIVE',
    "cancelled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "membership_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "gym_access" BOOLEAN NOT NULL,
    "booking_discount_pct" INTEGER NOT NULL,
    "class_discount_pct" INTEGER NOT NULL,
    "free_booking_slots_per_month" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "transaction_code" VARCHAR(50) NOT NULL,
    "idempotency_key" VARCHAR(150) NOT NULL,
    "type" "transaction_type" NOT NULL,
    "top_up_method" "payment_method",
    "amount" DECIMAL(12,0) NOT NULL,
    "balance_after" DECIMAL(12,0) NOT NULL,
    "order_id" UUID,
    "order_item_id" UUID,
    "bank_transaction_id" UUID,
    "created_by" UUID,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_top_ups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "payment_code" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(12,0) NOT NULL,
    "status" "top_up_status" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "bank_transaction_id" UUID,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_top_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sepay_id" BIGINT NOT NULL,
    "bank_name" VARCHAR(100) NOT NULL,
    "account_number" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(12,0) NOT NULL,
    "content" TEXT NOT NULL,
    "payment_code" VARCHAR(50),
    "reference_code" VARCHAR(100),
    "transaction_date" TIMESTAMPTZ NOT NULL,
    "status" "bank_transaction_status" NOT NULL,
    "resolved_account_id" UUID,
    "handled_by" UUID,
    "handled_at" TIMESTAMPTZ,
    "note" VARCHAR(500),
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_mm_account_status" ON "member_memberships"("account_id", "status");

-- CreateIndex
CREATE INDEX "idx_mm_status_end" ON "member_memberships"("status", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "membership_orders_order_item_id_key" ON "membership_orders"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_membership_order_period" ON "membership_orders"("membership_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_transaction_code_key" ON "wallet_transactions"("transaction_code");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_idempotency_key_key" ON "wallet_transactions"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_bank_transaction_id_key" ON "wallet_transactions"("bank_transaction_id");

-- CreateIndex
CREATE INDEX "idx_wtx_account_date" ON "wallet_transactions"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_wtx_type_date" ON "wallet_transactions"("type", "created_at");

-- CreateIndex
CREATE INDEX "idx_wtx_order" ON "wallet_transactions"("order_id");

-- CreateIndex
CREATE INDEX "idx_wtx_order_item" ON "wallet_transactions"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_top_ups_payment_code_key" ON "wallet_top_ups"("payment_code");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_top_ups_bank_transaction_id_key" ON "wallet_top_ups"("bank_transaction_id");

-- CreateIndex
CREATE INDEX "idx_top_ups_account_date" ON "wallet_top_ups"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_top_ups_status_expires" ON "wallet_top_ups"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_sepay_id_key" ON "bank_transactions"("sepay_id");

-- CreateIndex
CREATE INDEX "idx_bank_tx_status_date" ON "bank_transactions"("status", "transaction_date");

-- CreateIndex
CREATE INDEX "idx_bank_tx_payment_code" ON "bank_transactions"("payment_code");

-- AddForeignKey
ALTER TABLE "member_memberships" ADD CONSTRAINT "member_memberships_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_memberships" ADD CONSTRAINT "member_memberships_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_orders" ADD CONSTRAINT "membership_orders_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "member_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_orders" ADD CONSTRAINT "membership_orders_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "member_profile"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_top_ups" ADD CONSTRAINT "wallet_top_ups_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "member_profile"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_top_ups" ADD CONSTRAINT "wallet_top_ups_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_resolved_account_id_fkey" FOREIGN KEY ("resolved_account_id") REFERENCES "member_profile"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
