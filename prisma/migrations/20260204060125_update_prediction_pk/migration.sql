/*
  Warnings:

  - You are about to drop the column `prediction_date` on the `DividendReceived` table. All the data in the column will be lost.
  - The primary key for the `Prediction` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `confidence_score` on the `Prediction` table. All the data in the column will be lost.
  - You are about to drop the column `model_version` on the `Prediction` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_id,predicted_stock_symbol,predicted_ex_date]` on the table `DividendReceived` will be added. If there are existing duplicate values, this will fail.
  - Made the column `predicted_ex_dividend_date` on table `Prediction` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "DividendReceived" DROP CONSTRAINT "DividendReceived_predicted_stock_symbol_prediction_date_fkey";

-- DropIndex
DROP INDEX "DividendReceived_user_id_predicted_stock_symbol_prediction__key";

-- AlterTable
ALTER TABLE "DividendReceived" DROP COLUMN "prediction_date";

-- AlterTable
ALTER TABLE "Prediction" DROP CONSTRAINT "Prediction_pkey",
DROP COLUMN "confidence_score",
DROP COLUMN "model_version",
ALTER COLUMN "predicted_ex_dividend_date" SET NOT NULL,
ADD CONSTRAINT "Prediction_pkey" PRIMARY KEY ("stock_symbol", "predicted_ex_dividend_date");

-- CreateIndex
CREATE UNIQUE INDEX "DividendReceived_user_id_predicted_stock_symbol_predicted_e_key" ON "DividendReceived"("user_id", "predicted_stock_symbol", "predicted_ex_date");

-- AddForeignKey
ALTER TABLE "DividendReceived" ADD CONSTRAINT "DividendReceived_predicted_stock_symbol_predicted_ex_date_fkey" FOREIGN KEY ("predicted_stock_symbol", "predicted_ex_date") REFERENCES "Prediction"("stock_symbol", "predicted_ex_dividend_date") ON DELETE SET NULL ON UPDATE CASCADE;
