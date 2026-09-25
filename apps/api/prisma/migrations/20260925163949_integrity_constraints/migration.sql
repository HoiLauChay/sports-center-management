-- CreateIndex
CREATE UNIQUE INDEX "uq_ccr_pending" ON "class_coach_registrations"("class_id", "coach_id") WHERE (status = 'PENDING');

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrollment_active" ON "class_enrollments"("class_id", "account_id") WHERE (status = 'ENROLLED');

-- CreateIndex
CREATE UNIQUE INDEX "uq_coach_spec_active" ON "coach_specializations"("coach_id", "sport_id") WHERE (status IN ('PENDING', 'APPROVED'));

-- CreateIndex
CREATE UNIQUE INDEX "uq_coupons_code" ON "coupons"("code") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "uq_facilities_name" ON "facilities"("name") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "uq_booking_single_item" ON "facility_bookings"("order_item_id") WHERE (package_id IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "uq_mm_one_active" ON "member_memberships"("account_id") WHERE (status = 'ACTIVE');

-- CreateIndex
CREATE UNIQUE INDEX "uq_order_one_membership" ON "order_items"("order_id") WHERE (type = 'MEMBERSHIP');

-- CreateIndex
CREATE UNIQUE INDEX "uq_sports_name" ON "sports"("name") WHERE (deleted_at IS NULL);

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE FUNCTION valid_days_of_week(v integer[]) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT CASE WHEN array_ndims(v) IS DISTINCT FROM 1 THEN false ELSE
    COALESCE(cardinality(v) BETWEEN 1 AND 7
      AND array_position(v, NULL) IS NULL
      AND v <@ ARRAY[0,1,2,3,4,5,6]
      AND cardinality(v) = (SELECT count(DISTINCT d) FROM unnest(v) AS x(d)), false) END
$$;

ALTER TABLE "facility_maintenances" ADD CONSTRAINT "ex_maintenance_overlap"
  EXCLUDE USING gist ("facility_id" WITH =, tstzrange("start_at", "end_at", '[)') WITH &&)
  WHERE ("deleted_at" IS NULL);
ALTER TABLE "class_sessions" ADD CONSTRAINT "ex_session_facility_overlap"
  EXCLUDE USING gist ("facility_id" WITH =,
    tsrange("session_date" + "start_time", "session_date" + "end_time", '[)') WITH &&)
  WHERE ("status" = 'SCHEDULED');
ALTER TABLE "membership_orders" ADD CONSTRAINT "ex_membership_period_overlap"
  EXCLUDE USING gist ("membership_id" WITH =, daterange("period_start", "period_end", '[)') WITH &&);

ALTER TABLE "bank_transactions" ADD CONSTRAINT "ck_bank_tx_amount" CHECK (amount > 0);
ALTER TABLE "wallet_top_ups" ADD CONSTRAINT "ck_top_ups_amount" CHECK (amount > 0);
ALTER TABLE "wallet_top_ups" ADD CONSTRAINT "ck_top_ups_success" CHECK ((status = 'SUCCESS') = (bank_transaction_id IS NOT NULL AND completed_at IS NOT NULL));
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "ck_wtx_amounts" CHECK (amount > 0 AND balance_after >= 0);
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "ck_wtx_top_up_method" CHECK ((type = 'TOP_UP') = (top_up_method IS NOT NULL) AND (top_up_method IS NULL OR top_up_method <> 'WALLET'));
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "ck_wtx_bank_transfer" CHECK (bank_transaction_id IS NULL OR top_up_method = 'TRANSFER');
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "ck_wtx_type_refs" CHECK ((type = 'TOP_UP' AND order_id IS NULL AND order_item_id IS NULL) OR (type = 'PAYMENT' AND order_id IS NOT NULL AND order_item_id IS NULL AND bank_transaction_id IS NULL) OR (type = 'REFUND' AND order_id IS NOT NULL AND order_item_id IS NOT NULL AND bank_transaction_id IS NULL));
ALTER TABLE "facilities" ADD CONSTRAINT "ck_facilities_values" CHECK (capacity_per_slot >= 1 AND price_per_slot >= 0);
ALTER TABLE "facility_maintenances" ADD CONSTRAINT "ck_fm_range" CHECK (end_at > start_at);
ALTER TABLE "facility_packages" ADD CONSTRAINT "ck_fp_values" CHECK (unit_price >= 0 AND end_date >= start_date AND end_time > start_time);
ALTER TABLE "facility_packages" ADD CONSTRAINT "ck_fp_days" CHECK (valid_days_of_week(days_of_week));
ALTER TABLE "facility_bookings" ADD CONSTRAINT "ck_booking_values" CHECK (unit_price >= 0 AND end_time > start_time);
ALTER TABLE "facility_bookings" ADD CONSTRAINT "ck_booking_guest" CHECK (account_id IS NOT NULL OR (package_id IS NULL AND benefit = 'NONE'));
ALTER TABLE "courses" ADD CONSTRAINT "ck_courses_values" CHECK (total_sessions >= 1 AND price >= 0);
ALTER TABLE "classes" ADD CONSTRAINT "ck_classes_students" CHECK (min_students >= 1 AND max_students >= min_students);
ALTER TABLE "classes" ADD CONSTRAINT "ck_classes_dates" CHECK ((start_date IS NULL AND end_date IS NULL) OR (start_date IS NOT NULL AND end_date IS NOT NULL AND end_date >= start_date));
ALTER TABLE "classes" ADD CONSTRAINT "ck_classes_open" CHECK (status <> 'OPEN' OR (coach_id IS NOT NULL AND start_date IS NOT NULL));
ALTER TABLE "class_sessions" ADD CONSTRAINT "ck_cs_values" CHECK (session_number >= 1 AND end_time > start_time);
ALTER TABLE "memberships" ADD CONSTRAINT "ck_memberships_values" CHECK (price >= 0 AND duration_days >= 1 AND free_booking_slots_per_month >= 0);
ALTER TABLE "memberships" ADD CONSTRAINT "ck_memberships_pct" CHECK (booking_discount_pct BETWEEN 0 AND 100 AND class_discount_pct BETWEEN 0 AND 100);
ALTER TABLE "member_memberships" ADD CONSTRAINT "ck_mm_dates" CHECK (end_date > start_date);
ALTER TABLE "membership_orders" ADD CONSTRAINT "ck_mo_period" CHECK (period_end > period_start);
ALTER TABLE "membership_orders" ADD CONSTRAINT "ck_mo_benefits" CHECK (booking_discount_pct BETWEEN 0 AND 100 AND class_discount_pct BETWEEN 0 AND 100 AND free_booking_slots_per_month >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "ck_orders_non_negative" CHECK (subtotal >= 0 AND membership_discount_amount >= 0 AND coupon_discount_amount >= 0 AND total_amount >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "ck_orders_total" CHECK (total_amount = subtotal - membership_discount_amount - coupon_discount_amount);
ALTER TABLE "orders" ADD CONSTRAINT "ck_orders_refunded" CHECK (refunded_amount BETWEEN 0 AND total_amount);
ALTER TABLE "orders" ADD CONSTRAINT "ck_orders_status" CHECK ((status = 'PAID' AND refunded_amount = 0) OR (status = 'PARTIALLY_REFUNDED' AND refunded_amount > 0 AND refunded_amount < total_amount) OR (status = 'REFUNDED' AND total_amount > 0 AND refunded_amount = total_amount));
ALTER TABLE "orders" ADD CONSTRAINT "ck_orders_snapshot" CHECK (jsonb_typeof(invoice_snapshot) = 'object' AND invoice_snapshot ? 'schema_version');
ALTER TABLE "orders" ADD CONSTRAINT "ck_orders_guest" CHECK (account_id IS NOT NULL OR (length(btrim(coalesce(guest_name, ''))) > 0 AND length(btrim(coalesce(guest_phone, ''))) > 0 AND created_by IS NOT NULL AND payment_method <> 'WALLET' AND coupon_id IS NULL AND membership_discount_amount = 0 AND refunded_amount = 0));
ALTER TABLE "order_items" ADD CONSTRAINT "ck_order_items_non_negative" CHECK (line_number >= 1 AND subtotal >= 0 AND membership_discount_amount >= 0 AND coupon_discount_amount >= 0 AND total_amount >= 0);
ALTER TABLE "order_items" ADD CONSTRAINT "ck_order_items_total" CHECK (total_amount = subtotal - membership_discount_amount - coupon_discount_amount);
ALTER TABLE "order_items" ADD CONSTRAINT "ck_order_items_refunded" CHECK (refunded_amount BETWEEN 0 AND total_amount);
ALTER TABLE "order_items" ADD CONSTRAINT "ck_order_items_membership" CHECK (type <> 'MEMBERSHIP' OR (refunded_amount = 0 AND membership_discount_amount = 0));
ALTER TABLE "order_items" ADD CONSTRAINT "ck_order_items_snapshot" CHECK (jsonb_typeof(item_snapshot) = 'object' AND item_snapshot ? 'schema_version');
ALTER TABLE "coupons" ADD CONSTRAINT "ck_coupons_value" CHECK (discount_value > 0 AND (discount_type <> 'PERCENT' OR discount_value <= 100));
ALTER TABLE "coupons" ADD CONSTRAINT "ck_coupons_amounts" CHECK ((max_discount IS NULL OR max_discount >= 0) AND (min_order_amount IS NULL OR min_order_amount >= 0));
ALTER TABLE "coupons" ADD CONSTRAINT "ck_coupons_uses" CHECK ((max_uses IS NULL OR max_uses >= 0) AND max_uses_per_user >= 1);
ALTER TABLE "coupons" ADD CONSTRAINT "ck_coupons_validity" CHECK (valid_to > valid_from);
ALTER TABLE "coupons" ADD CONSTRAINT "ck_coupons_code" CHECK (code = upper(btrim(code)));
ALTER TABLE "system_settings" ADD CONSTRAINT "ck_settings_single_row" CHECK (id = 1);
ALTER TABLE "system_settings" ADD CONSTRAINT "ck_settings_hours" CHECK (open_time < close_time AND slot_duration_minutes > 0);
ALTER TABLE "system_settings" ADD CONSTRAINT "ck_settings_deadlines" CHECK (max_advance_booking_days >= 0 AND booking_cancel_deadline_hours >= 0 AND course_cancel_deadline_days >= 0 AND membership_expiry_warning_days >= 0);
ALTER TABLE "system_settings" ADD CONSTRAINT "ck_settings_top_up" CHECK (top_up_min_amount > 0 AND top_up_expiry_minutes > 0);

CREATE FUNCTION guard_immutable_row() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Rows of % cannot be deleted', TG_TABLE_NAME;
  END IF;
  IF TG_NARGS = 0 THEN
    RAISE EXCEPTION 'Rows of % cannot be updated', TG_TABLE_NAME;
  END IF;
  IF (to_jsonb(NEW) - TG_ARGV) IS DISTINCT FROM (to_jsonb(OLD) - TG_ARGV) THEN
    RAISE EXCEPTION 'Only % can change on %', array_to_string(TG_ARGV, ', '), TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "trg_orders_immutable" BEFORE UPDATE OR DELETE ON "orders"
  FOR EACH ROW EXECUTE FUNCTION guard_immutable_row('status', 'refunded_amount', 'updated_at');
CREATE TRIGGER "trg_order_items_immutable" BEFORE UPDATE OR DELETE ON "order_items"
  FOR EACH ROW EXECUTE FUNCTION guard_immutable_row('refunded_amount', 'updated_at');
CREATE TRIGGER "trg_wallet_transactions_immutable" BEFORE UPDATE OR DELETE ON "wallet_transactions"
  FOR EACH ROW EXECUTE FUNCTION guard_immutable_row();
CREATE TRIGGER "trg_membership_orders_immutable" BEFORE UPDATE OR DELETE ON "membership_orders"
  FOR EACH ROW EXECUTE FUNCTION guard_immutable_row();
