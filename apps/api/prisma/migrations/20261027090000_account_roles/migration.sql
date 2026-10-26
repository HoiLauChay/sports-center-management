-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "roles" "role"[] DEFAULT ARRAY['MEMBER']::"role"[];

UPDATE "accounts" SET "roles" = ARRAY["role"];
