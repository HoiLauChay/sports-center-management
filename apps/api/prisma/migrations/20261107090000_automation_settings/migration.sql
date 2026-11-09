-- CreateTable
CREATE TABLE "automation_settings" (
    "key" VARCHAR(50) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "threshold" INTEGER,
    "last_run_at" TIMESTAMPTZ,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_settings_pkey" PRIMARY KEY ("key")
);
