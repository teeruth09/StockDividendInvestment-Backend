/*
  Warnings:

  - You are about to drop the column `expected_return` on the `Prediction` table. All the data in the column will be lost.
  - You are about to drop the column `predicted_dividend_yield` on the `Prediction` table. All the data in the column will be lost.
  - You are about to drop the column `predicted_price` on the `Prediction` table. All the data in the column will be lost.
  - You are about to drop the column `recommendation_type` on the `Prediction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Prediction" DROP COLUMN "expected_return",
DROP COLUMN "predicted_dividend_yield",
DROP COLUMN "predicted_price",
DROP COLUMN "recommendation_type",
ADD COLUMN     "predicted_record_date" TIMESTAMP(3);
