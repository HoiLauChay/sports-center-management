-- AlterTable
ALTER TABLE "bank_transactions" ALTER COLUMN "sepay_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "uq_bank_tx_reference" ON "bank_transactions"("account_number", "reference_code");
