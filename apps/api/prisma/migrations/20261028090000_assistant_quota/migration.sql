-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "ai_questions_per_month" INTEGER NOT NULL DEFAULT 100;

-- AlterTable: periods already sold keep the quota of their package at migration time.
-- Sold periods are immutable, so the guard is lifted for the backfill only.
DROP TRIGGER "trg_membership_orders_immutable" ON "membership_orders";

ALTER TABLE "membership_orders" ADD COLUMN     "ai_questions_per_month" INTEGER;

UPDATE "membership_orders" mo
SET "ai_questions_per_month" = m."ai_questions_per_month"
FROM "member_memberships" mm
JOIN "memberships" m ON m."id" = mm."package_id"
WHERE mm."id" = mo."membership_id";

ALTER TABLE "membership_orders" ALTER COLUMN "ai_questions_per_month" SET NOT NULL;

CREATE TRIGGER "trg_membership_orders_immutable" BEFORE UPDATE OR DELETE ON "membership_orders"
  FOR EACH ROW EXECUTE FUNCTION guard_immutable_row();

-- CreateTable
CREATE TABLE "assistant_usages" (
    "account_id" UUID NOT NULL,
    "period" CHAR(7) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_usages_pkey" PRIMARY KEY ("account_id","period")
);

-- AddForeignKey
ALTER TABLE "assistant_usages" ADD CONSTRAINT "assistant_usages_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
