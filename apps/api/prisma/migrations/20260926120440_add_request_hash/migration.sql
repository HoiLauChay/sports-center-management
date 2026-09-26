-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "request_hash" CHAR(64);

-- AlterTable
ALTER TABLE "wallet_transactions" ADD COLUMN     "request_hash" CHAR(64);
