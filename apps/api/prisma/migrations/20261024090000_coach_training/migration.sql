-- CreateEnum
CREATE TYPE "progress_milestone" AS ENUM ('MID', 'FINAL');

-- CreateEnum
CREATE TYPE "announcement_kind" AS ENUM ('NOTICE', 'HOMEWORK');

-- AlterTable
ALTER TABLE "class_sessions" ADD COLUMN     "coach_id" UUID,
ADD COLUMN     "note_homework" TEXT;

-- AlterTable
ALTER TABLE "coach_specializations" ADD COLUMN     "certificate_urls" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "experience_note" VARCHAR(1000),
ADD COLUMN     "experience_years" INTEGER;

-- CreateTable
CREATE TABLE "training_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "account_id" UUID,
    "goals" VARCHAR(1000) NOT NULL,
    "content" TEXT NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "coach_id" UUID NOT NULL,
    "milestone" "progress_milestone" NOT NULL,
    "technique" INTEGER NOT NULL,
    "fitness" INTEGER NOT NULL,
    "attitude" INTEGER NOT NULL,
    "comment" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "kind" "announcement_kind" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_tp_account" ON "training_plans"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tp_class_plan" ON "training_plans"("class_id") WHERE (account_id IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "uq_tp_member_plan" ON "training_plans"("class_id", "account_id") WHERE (account_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_pr_account" ON "progress_reviews"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_pr_class_account_milestone" ON "progress_reviews"("class_id", "account_id", "milestone");

-- CreateIndex
CREATE INDEX "idx_ca_class_date" ON "class_announcements"("class_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_cs_coach_date" ON "class_sessions"("coach_id", "session_date");

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_reviews" ADD CONSTRAINT "progress_reviews_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_reviews" ADD CONSTRAINT "progress_reviews_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_reviews" ADD CONSTRAINT "progress_reviews_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_announcements" ADD CONSTRAINT "class_announcements_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_announcements" ADD CONSTRAINT "class_announcements_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "coach_specializations" ADD CONSTRAINT "ck_coach_spec_years" CHECK ("experience_years" IS NULL OR "experience_years" BETWEEN 0 AND 60);

ALTER TABLE "progress_reviews" ADD CONSTRAINT "ck_pr_scores" CHECK ("technique" BETWEEN 1 AND 5 AND "fitness" BETWEEN 1 AND 5 AND "attitude" BETWEEN 1 AND 5);
