-- order_items
DROP TRIGGER "trg_order_items_immutable" ON "order_items";
ALTER TABLE "order_items" ADD COLUMN "coupon_id" UUID;
UPDATE "order_items" AS i SET "coupon_id" = o."coupon_id"
FROM "orders" AS o
WHERE o."id" = i."order_id" AND o."coupon_id" IS NOT NULL
  AND (i."coupon_discount_amount" > 0 OR NOT EXISTS (
    SELECT 1 FROM "order_items" AS other WHERE other."order_id" = o."id" AND other."coupon_discount_amount" > 0
  ));
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "ck_order_items_coupon" CHECK (coupon_id IS NOT NULL OR coupon_discount_amount = 0);
CREATE INDEX "idx_order_items_coupon" ON "order_items"("coupon_id");
CREATE TRIGGER "trg_order_items_immutable" BEFORE UPDATE OR DELETE ON "order_items"
  FOR EACH ROW EXECUTE FUNCTION guard_immutable_row('refunded_at', 'updated_at');

-- orders
ALTER TABLE "orders" DROP CONSTRAINT "ck_orders_guest";
ALTER TABLE "orders" DROP CONSTRAINT "orders_coupon_id_fkey";
DROP INDEX "idx_orders_coupon_account";
ALTER TABLE "orders" DROP COLUMN "coupon_id";
ALTER TABLE "orders" ADD CONSTRAINT "ck_orders_guest" CHECK (account_id IS NOT NULL OR (length(btrim(coalesce(guest_name, ''))) > 0 AND length(btrim(coalesce(guest_phone, ''))) > 0 AND created_by IS NOT NULL AND payment_method <> 'WALLET' AND membership_discount_amount = 0));
