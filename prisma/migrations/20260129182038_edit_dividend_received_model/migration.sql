/*
  Warnings:

  - A unique constraint covering the columns `[user_id,dividend_id]` on the table `DividendReceived` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,predicted_stock_symbol,prediction_date]` on the table `DividendReceived` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "DividendReceived_user_id_dividend_id_key" ON "DividendReceived"("user_id", "dividend_id");

-- CreateIndex
CREATE UNIQUE INDEX "DividendReceived_user_id_predicted_stock_symbol_prediction__key" ON "DividendReceived"("user_id", "predicted_stock_symbol", "prediction_date");
