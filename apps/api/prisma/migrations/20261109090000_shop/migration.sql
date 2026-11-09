-- CreateEnum
CREATE TYPE "stock_reason" AS ENUM ('IMPORT', 'ADJUST', 'SALE', 'SALE_CANCEL');

-- CreateEnum
CREATE TYPE "fulfillment_status" AS ENUM ('PENDING_PICKUP', 'PICKED_UP', 'CANCELLED');

-- AlterEnum
ALTER TYPE "order_item_type" ADD VALUE 'PRODUCT_SALE';

-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'SHOP';

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "shop_pickup_hours" INTEGER NOT NULL DEFAULT 48;

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" CITEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sku" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "category_id" UUID NOT NULL,
    "sport_id" UUID,
    "price" DECIMAL(12,0) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "reason" "stock_reason" NOT NULL,
    "delta" INTEGER NOT NULL,
    "stock_after" INTEGER NOT NULL,
    "note" VARCHAR(500),
    "sale_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_sales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_item_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,0) NOT NULL,
    "status" "fulfillment_status" NOT NULL,
    "pickup_deadline" TIMESTAMPTZ,
    "picked_up_at" TIMESTAMPTZ,
    "picked_up_by" UUID,
    "cancelled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_categories_name" ON "product_categories"("name") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_products_category" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "idx_products_sport" ON "products"("sport_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_products_sku" ON "products"("sku") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_stock_movements_product_date" ON "stock_movements"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_stock_movements_sale" ON "stock_movements"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_sales_order_item_id_key" ON "product_sales"("order_item_id");

-- CreateIndex
CREATE INDEX "idx_product_sales_status_deadline" ON "product_sales"("status", "pickup_deadline");

-- CreateIndex
CREATE INDEX "idx_product_sales_product" ON "product_sales"("product_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "product_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sales" ADD CONSTRAINT "product_sales_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sales" ADD CONSTRAINT "product_sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sales" ADD CONSTRAINT "product_sales_picked_up_by_fkey" FOREIGN KEY ("picked_up_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Invariants Prisma cannot express
ALTER TABLE "system_settings" ADD CONSTRAINT "ck_settings_shop_pickup_hours" CHECK ("shop_pickup_hours" > 0);
ALTER TABLE "products" ADD CONSTRAINT "ck_products_price" CHECK ("price" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "ck_products_stock" CHECK ("stock" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "ck_products_low_stock" CHECK ("low_stock_threshold" >= 0);
ALTER TABLE "stock_movements" ADD CONSTRAINT "ck_stock_movements_amounts" CHECK ("delta" <> 0 AND "stock_after" >= 0);
ALTER TABLE "product_sales" ADD CONSTRAINT "ck_product_sales_amounts" CHECK ("quantity" > 0 AND "unit_price" >= 0);
ALTER TABLE "product_sales" ADD CONSTRAINT "ck_product_sales_pickup" CHECK (("status" = 'PICKED_UP') = ("picked_up_at" IS NOT NULL));
ALTER TABLE "product_sales" ADD CONSTRAINT "ck_product_sales_cancel" CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL));
