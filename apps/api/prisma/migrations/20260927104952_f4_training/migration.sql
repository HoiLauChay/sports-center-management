-- CreateEnum
CREATE TYPE "attendance_status" AS ENUM ('PRESENT', 'ABSENT', 'LATE');

-- CreateTable
CREATE TABLE "center_checkins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "checked_by" UUID NOT NULL,
    "check_in_time" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "center_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_attendance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "status" "attendance_status" NOT NULL,
    "note" VARCHAR(500),
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_evaluations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "coach_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_checkin_account_time" ON "center_checkins"("account_id", "check_in_time");

-- CreateIndex
CREATE INDEX "idx_attendance_account" ON "class_attendance"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_attendance_session_account" ON "class_attendance"("session_id", "account_id");

-- CreateIndex
CREATE INDEX "idx_eval_session_account" ON "member_evaluations"("session_id", "account_id");

-- CreateIndex
CREATE INDEX "idx_eval_account" ON "member_evaluations"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_eval_session_account" ON "member_evaluations"("session_id", "account_id") WHERE (deleted_at IS NULL);

-- AddForeignKey
ALTER TABLE "center_checkins" ADD CONSTRAINT "center_checkins_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "center_checkins" ADD CONSTRAINT "center_checkins_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_attendance" ADD CONSTRAINT "class_attendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_attendance" ADD CONSTRAINT "class_attendance_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_attendance" ADD CONSTRAINT "class_attendance_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_evaluations" ADD CONSTRAINT "member_evaluations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_evaluations" ADD CONSTRAINT "member_evaluations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_evaluations" ADD CONSTRAINT "member_evaluations_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "member_evaluations" ADD CONSTRAINT "ck_eval_rating" CHECK ("rating" BETWEEN 1 AND 5);
