/*
  Warnings:

  - A unique constraint covering the columns `[user_id,predicted_stock_symbol,prediction_date,predicted_ex_date]` on the table `DividendReceived` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "DividendReceived_user_id_predicted_stock_symbol_prediction__key";

-- AlterTable
ALTER TABLE "DividendReceived" ADD COLUMN     "predicted_ex_date" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "DividendReceived_user_id_predicted_stock_symbol_prediction__key" ON "DividendReceived"("user_id", "predicted_stock_symbol", "prediction_date", "predicted_ex_date");
