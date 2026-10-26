-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "email_muted_types" "notification_type"[] DEFAULT ARRAY[]::"notification_type"[];
