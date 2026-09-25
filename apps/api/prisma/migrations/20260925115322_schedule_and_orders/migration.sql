-- CreateEnum
CREATE TYPE "facility_type" AS ENUM ('GYM', 'COURT', 'ROOM', 'FIELD');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "booking_benefit" AS ENUM ('NONE', 'DISCOUNT', 'GYM_ACCESS', 'FREE_SLOT');

-- CreateEnum
CREATE TYPE "facility_package_status" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "class_status" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'OPEN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "coach_registration_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "coach_registration_source" AS ENUM ('COACH_REGISTERED', 'MANAGER_ASSIGNED');

-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('ENROLLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "order_item_type" AS ENUM ('MEMBERSHIP', 'FACILITY_BOOKING', 'FACILITY_PACKAGE', 'COURSE_ENROLLMENT');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('WALLET', 'CASH', 'CARD', 'TRANSFER');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('PERCENT', 'FIXED');

-- CreateTable
CREATE TABLE "sports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "icon_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "type" "facility_type" NOT NULL,
    "capacity_per_slot" INTEGER NOT NULL,
    "price_per_slot" DECIMAL(12,0) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_sports" (
    "facility_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,

    CONSTRAINT "facility_sports_pkey" PRIMARY KEY ("facility_id","sport_id")
);

-- CreateTable
CREATE TABLE "facility_maintenances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_maintenances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "days_of_week" INTEGER[] NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "unit_price" DECIMAL(12,0) NOT NULL,
    "status" "facility_package_status" NOT NULL DEFAULT 'ACTIVE',
    "cancelled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "account_id" UUID,
    "order_item_id" UUID NOT NULL,
    "package_id" UUID,
    "booking_date" DATE NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "unit_price" DECIMAL(12,0) NOT NULL,
    "benefit" "booking_benefit" NOT NULL DEFAULT 'NONE',
    "status" "booking_status" NOT NULL DEFAULT 'CONFIRMED',
    "cancelled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "sport_id" UUID NOT NULL,
    "description" TEXT,
    "total_sessions" INTEGER NOT NULL,
    "price" DECIMAL(12,0) NOT NULL,
    "thumbnail_url" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "coach_id" UUID,
    "facility_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "min_students" INTEGER NOT NULL DEFAULT 1,
    "min_students_override" BOOLEAN NOT NULL DEFAULT false,
    "max_students" INTEGER NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "weekly_schedule" JSONB NOT NULL,
    "status" "class_status" NOT NULL DEFAULT 'DRAFT',
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "cancel_reason" VARCHAR(500),
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_coach_registrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "coach_id" UUID NOT NULL,
    "source" "coach_registration_source" NOT NULL,
    "status" "coach_registration_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_coach_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "session_number" INTEGER NOT NULL,
    "session_date" DATE NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "status" "session_status" NOT NULL DEFAULT 'SCHEDULED',
    "cancel_reason" VARCHAR(500),
    "note_title" VARCHAR(255),
    "note_content" TEXT,
    "note_attachments" JSONB,
    "note_updated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "status" "enrollment_status" NOT NULL DEFAULT 'ENROLLED',
    "enrolled_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMPTZ,

    CONSTRAINT "class_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_number" VARCHAR(50) NOT NULL,
    "idempotency_key" VARCHAR(150) NOT NULL,
    "account_id" UUID,
    "created_by" UUID,
    "invoice_snapshot" JSONB NOT NULL,
    "subtotal" DECIMAL(12,0) NOT NULL,
    "membership_discount_amount" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "coupon_discount_amount" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,0) NOT NULL,
    "refunded_amount" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "coupon_id" UUID,
    "payment_method" "payment_method" NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'PAID',
    "guest_name" VARCHAR(255),
    "guest_phone" VARCHAR(20),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "type" "order_item_type" NOT NULL,
    "item_snapshot" JSONB NOT NULL,
    "subtotal" DECIMAL(12,0) NOT NULL,
    "membership_discount_amount" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "coupon_discount_amount" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,0) NOT NULL,
    "refunded_amount" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "discount_type" "discount_type" NOT NULL,
    "discount_value" DECIMAL(12,0) NOT NULL,
    "max_discount" DECIMAL(12,0),
    "min_order_amount" DECIMAL(12,0),
    "max_uses" INTEGER,
    "max_uses_per_user" INTEGER NOT NULL DEFAULT 1,
    "applicable_types" "order_item_type"[],
    "valid_from" TIMESTAMPTZ NOT NULL,
    "valid_to" TIMESTAMPTZ NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_facility_sports_sport" ON "facility_sports"("sport_id");

-- CreateIndex
CREATE INDEX "idx_fm_facility_range" ON "facility_maintenances"("facility_id", "start_at", "end_at");

-- CreateIndex
CREATE UNIQUE INDEX "facility_packages_order_item_id_key" ON "facility_packages"("order_item_id");

-- CreateIndex
CREATE INDEX "idx_fp_account_status" ON "facility_packages"("account_id", "status");

-- CreateIndex
CREATE INDEX "idx_booking_facility_date_time" ON "facility_bookings"("facility_id", "booking_date", "start_time");

-- CreateIndex
CREATE INDEX "idx_booking_account_date" ON "facility_bookings"("account_id", "booking_date");

-- CreateIndex
CREATE INDEX "idx_booking_package" ON "facility_bookings"("package_id");

-- CreateIndex
CREATE INDEX "idx_booking_order_item" ON "facility_bookings"("order_item_id");

-- CreateIndex
CREATE INDEX "idx_classes_course_status" ON "classes"("course_id", "status");

-- CreateIndex
CREATE INDEX "idx_classes_coach" ON "classes"("coach_id");

-- CreateIndex
CREATE INDEX "idx_classes_status_dates" ON "classes"("status", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "idx_ccr_class_coach" ON "class_coach_registrations"("class_id", "coach_id");

-- CreateIndex
CREATE INDEX "idx_cs_facility_date_time" ON "class_sessions"("facility_id", "session_date", "start_time");

-- CreateIndex
CREATE INDEX "idx_cs_date_time" ON "class_sessions"("session_date", "start_time");

-- CreateIndex
CREATE UNIQUE INDEX "uq_cs_class_session_num" ON "class_sessions"("class_id", "session_number");

-- CreateIndex
CREATE UNIQUE INDEX "class_enrollments_order_item_id_key" ON "class_enrollments"("order_item_id");

-- CreateIndex
CREATE INDEX "idx_enrollment_class_account" ON "class_enrollments"("class_id", "account_id");

-- CreateIndex
CREATE INDEX "idx_enrollment_account" ON "class_enrollments"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_orders_account" ON "orders"("account_id");

-- CreateIndex
CREATE INDEX "idx_orders_date_status" ON "orders"("created_at", "status");

-- CreateIndex
CREATE INDEX "idx_orders_coupon_account" ON "orders"("coupon_id", "account_id");

-- CreateIndex
CREATE INDEX "idx_orders_guest_phone" ON "orders"("guest_phone");

-- CreateIndex
CREATE INDEX "idx_order_items_type_date" ON "order_items"("type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_order_item_line" ON "order_items"("order_id", "line_number");

-- AddForeignKey
ALTER TABLE "facility_sports" ADD CONSTRAINT "facility_sports_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_sports" ADD CONSTRAINT "facility_sports_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_maintenances" ADD CONSTRAINT "facility_maintenances_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_maintenances" ADD CONSTRAINT "facility_maintenances_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_packages" ADD CONSTRAINT "facility_packages_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_packages" ADD CONSTRAINT "facility_packages_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_packages" ADD CONSTRAINT "facility_packages_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "facility_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_coach_registrations" ADD CONSTRAINT "class_coach_registrations_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_coach_registrations" ADD CONSTRAINT "class_coach_registrations_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_coach_registrations" ADD CONSTRAINT "class_coach_registrations_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_enrollments" ADD CONSTRAINT "class_enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_enrollments" ADD CONSTRAINT "class_enrollments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_enrollments" ADD CONSTRAINT "class_enrollments_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
