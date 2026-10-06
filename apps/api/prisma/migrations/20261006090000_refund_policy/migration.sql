-- classes
ALTER TABLE "classes" DROP COLUMN "min_students_override";

-- system_settings
ALTER TABLE "system_settings" DROP CONSTRAINT "ck_settings_deadlines";
ALTER TABLE "system_settings" DROP COLUMN "booking_cancel_deadline_hours",
DROP COLUMN "course_cancel_deadline_days";
ALTER TABLE "system_settings" ADD CONSTRAINT "ck_settings_deadlines" CHECK (max_advance_booking_days >= 0 AND membership_expiry_warning_days >= 0);

-- order_items
DROP TRIGGER "trg_order_items_immutable" ON "order_items";
ALTER TABLE "order_items" DROP CONSTRAINT "ck_order_items_refunded";
ALTER TABLE "order_items" DROP CONSTRAINT "ck_order_items_membership";
ALTER TABLE "order_items" ADD COLUMN "refunded_at" TIMESTAMPTZ;
UPDATE "order_items" SET "refunded_at" = "updated_at" WHERE "refunded_amount" > 0;
ALTER TABLE "order_items" DROP COLUMN "refunded_amount";
ALTER TABLE "order_items" ADD CONSTRAINT "ck_order_items_membership" CHECK (type <> 'MEMBERSHIP' OR (refunded_at IS NULL AND membership_discount_amount = 0));
CREATE TRIGGER "trg_order_items_immutable" BEFORE UPDATE OR DELETE ON "order_items"
  FOR EACH ROW EXECUTE FUNCTION guard_immutable_row('refunded_at', 'updated_at');

-- orders
DROP TRIGGER "trg_orders_immutable" ON "orders";
ALTER TABLE "orders" DROP CONSTRAINT "ck_orders_refunded";
ALTER TABLE "orders" DROP CONSTRAINT "ck_orders_status";
ALTER TABLE "orders" DROP CONSTRAINT "ck_orders_guest";
DROP INDEX "idx_orders_date_status";
ALTER TABLE "orders" DROP COLUMN "refunded_amount",
DROP COLUMN "status";
DROP TYPE "order_status";
CREATE INDEX "idx_orders_date" ON "orders"("created_at");
ALTER TABLE "orders" ADD CONSTRAINT "ck_orders_guest" CHECK (account_id IS NOT NULL OR (length(btrim(coalesce(guest_name, ''))) > 0 AND length(btrim(coalesce(guest_phone, ''))) > 0 AND created_by IS NOT NULL AND payment_method <> 'WALLET' AND coupon_id IS NULL AND membership_discount_amount = 0));
CREATE TRIGGER "trg_orders_immutable" BEFORE UPDATE OR DELETE ON "orders"
  FOR EACH ROW EXECUTE FUNCTION guard_immutable_row();

-- wallet_transactions
CREATE UNIQUE INDEX "uq_wtx_refund_item" ON "wallet_transactions"("order_item_id") WHERE (type = 'REFUND');
