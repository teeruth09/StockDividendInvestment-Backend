/*
  Warnings:

  - The primary key for the `Transaction` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_pkey",
ADD CONSTRAINT "Transaction_pkey" PRIMARY KEY ("user_id", "stock_symbol", "created_at", "transaction_type");
