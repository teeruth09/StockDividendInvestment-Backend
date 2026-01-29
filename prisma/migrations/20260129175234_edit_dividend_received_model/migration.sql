-- CreateEnum
CREATE TYPE "DividendStatus" AS ENUM ('PREDICTED', 'CONFIRMED', 'RECEIVED');

-- DropForeignKey
ALTER TABLE "DividendReceived" DROP CONSTRAINT "DividendReceived_dividend_id_fkey";

-- AlterTable
ALTER TABLE "DividendReceived" ADD COLUMN     "predicted_stock_symbol" TEXT,
ADD COLUMN     "prediction_date" TIMESTAMP(3),
ADD COLUMN     "status" "DividendStatus" NOT NULL DEFAULT 'PREDICTED',
ALTER COLUMN "dividend_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "DividendReceived" ADD CONSTRAINT "DividendReceived_dividend_id_fkey" FOREIGN KEY ("dividend_id") REFERENCES "Dividend"("dividend_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DividendReceived" ADD CONSTRAINT "DividendReceived_predicted_stock_symbol_prediction_date_fkey" FOREIGN KEY ("predicted_stock_symbol", "prediction_date") REFERENCES "Prediction"("stock_symbol", "prediction_date") ON DELETE SET NULL ON UPDATE CASCADE;
