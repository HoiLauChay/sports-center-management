-- CreateEnum
CREATE TYPE "specialization_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "coach_specializations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "coach_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,
    "status" "specialization_status" NOT NULL DEFAULT 'PENDING',
    "review_note" VARCHAR(500),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_specializations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_coach_spec_coach_sport" ON "coach_specializations"("coach_id", "sport_id");

-- CreateIndex
CREATE INDEX "idx_coach_spec_status_date" ON "coach_specializations"("status", "created_at");

-- AddForeignKey
ALTER TABLE "coach_specializations" ADD CONSTRAINT "coach_specializations_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_specializations" ADD CONSTRAINT "coach_specializations_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_specializations" ADD CONSTRAINT "coach_specializations_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
