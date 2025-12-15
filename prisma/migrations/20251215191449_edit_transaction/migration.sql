/*
  Warnings:

  - The primary key for the `Transaction` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[user_id,stock_symbol,created_at,transaction_type]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - The required column `transaction_id` was added to the `Transaction` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_pkey",
ADD COLUMN     "transaction_id" TEXT NOT NULL,
ADD CONSTRAINT "Transaction_pkey" PRIMARY KEY ("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_user_id_stock_symbol_created_at_transaction_typ_key" ON "Transaction"("user_id", "stock_symbol", "created_at", "transaction_type");
