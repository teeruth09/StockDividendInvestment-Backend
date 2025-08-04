-- CreateTable
CREATE TABLE "Stock" (
    "stock_symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "corporate_tax_rate" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("stock_symbol")
);

-- CreateTable
CREATE TABLE "User" (
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "HistoricalPrice" (
    "stock_symbol" TEXT NOT NULL,
    "price_date" TIMESTAMP(3) NOT NULL,
    "open_price" DOUBLE PRECISION NOT NULL,
    "high_price" DOUBLE PRECISION NOT NULL,
    "low_price" DOUBLE PRECISION NOT NULL,
    "close_price" DOUBLE PRECISION NOT NULL,
    "price_change" DOUBLE PRECISION,
    "percent_change" DOUBLE PRECISION,
    "volume_shares" BIGINT NOT NULL,
    "volume_value" BIGINT NOT NULL,

    CONSTRAINT "HistoricalPrice_pkey" PRIMARY KEY ("stock_symbol","price_date")
);

-- CreateTable
CREATE TABLE "Dividend" (
    "dividend_id" TEXT NOT NULL,
    "stock_symbol" TEXT NOT NULL,
    "announcement_date" TIMESTAMP(3) NOT NULL,
    "ex_dividend_date" TIMESTAMP(3) NOT NULL,
    "record_date" TIMESTAMP(3) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "dividend_per_share" DOUBLE PRECISION NOT NULL,
    "source_of_dividend" TEXT,
    "year_declared" INTEGER,

    CONSTRAINT "Dividend_pkey" PRIMARY KEY ("dividend_id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "user_id" TEXT NOT NULL,
    "stock_symbol" TEXT NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price_per_share" DOUBLE PRECISION NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("user_id","stock_symbol","transaction_date","transaction_type")
);

-- CreateTable
CREATE TABLE "DividendReceived" (
    "received_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "dividend_id" TEXT NOT NULL,
    "shares_held" INTEGER NOT NULL,
    "gross_dividend" DOUBLE PRECISION NOT NULL,
    "withholding_tax" DOUBLE PRECISION NOT NULL,
    "net_dividend_received" DOUBLE PRECISION NOT NULL,
    "payment_received_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DividendReceived_pkey" PRIMARY KEY ("received_id")
);

-- CreateTable
CREATE TABLE "TaxCredit" (
    "credit_id" TEXT NOT NULL,
    "received_id" TEXT NOT NULL,
    "tax_year" INTEGER NOT NULL,
    "corporate_tax_rate" DOUBLE PRECISION NOT NULL,
    "tax_credit_amount" DOUBLE PRECISION NOT NULL,
    "taxable_income" DOUBLE PRECISION NOT NULL,
    "user_tax_bracket" DOUBLE PRECISION NOT NULL,
    "tax_saving" DOUBLE PRECISION,
    "is_used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TaxCredit_pkey" PRIMARY KEY ("credit_id")
);

-- CreateTable
CREATE TABLE "UserTaxInfo" (
    "user_id" TEXT NOT NULL,
    "tax_year" INTEGER NOT NULL,
    "annual_income" DOUBLE PRECISION NOT NULL,
    "tax_bracket" DOUBLE PRECISION NOT NULL,
    "personal_deduction" DOUBLE PRECISION NOT NULL,
    "spouse_deduction" DOUBLE PRECISION NOT NULL,
    "child_deduction" DOUBLE PRECISION NOT NULL,
    "parent_deduction" DOUBLE PRECISION NOT NULL,
    "life_insurance_deduction" DOUBLE PRECISION NOT NULL,
    "health_insurance_deduction" DOUBLE PRECISION NOT NULL,
    "provident_fund_deduction" DOUBLE PRECISION NOT NULL,
    "retirement_mutual_fund" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "UserTaxInfo_pkey" PRIMARY KEY ("user_id","tax_year")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "stock_symbol" TEXT NOT NULL,
    "prediction_date" TIMESTAMP(3) NOT NULL,
    "predicted_ex_dividend_date" TIMESTAMP(3),
    "predicted_payment_date" TIMESTAMP(3),
    "predicted_dividend_per_share" DOUBLE PRECISION,
    "predicted_dividend_yield" DOUBLE PRECISION,
    "predicted_price" DOUBLE PRECISION,
    "expected_return" DOUBLE PRECISION,
    "recommendation_type" TEXT,
    "confidence_score" INTEGER,
    "model_version" TEXT,
    "prediction_horizon_days" INTEGER,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("stock_symbol","prediction_date")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "user_id" TEXT NOT NULL,
    "stock_symbol" TEXT NOT NULL,
    "current_quantity" INTEGER NOT NULL,
    "total_invested" DOUBLE PRECISION NOT NULL,
    "average_cost" DOUBLE PRECISION NOT NULL,
    "last_transaction_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("user_id","stock_symbol")
);

-- CreateIndex
CREATE UNIQUE INDEX "Stock_stock_symbol_key" ON "Stock"("stock_symbol");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_name_key" ON "Stock"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TaxCredit_received_id_key" ON "TaxCredit"("received_id");

-- AddForeignKey
ALTER TABLE "HistoricalPrice" ADD CONSTRAINT "HistoricalPrice_stock_symbol_fkey" FOREIGN KEY ("stock_symbol") REFERENCES "Stock"("stock_symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_stock_symbol_fkey" FOREIGN KEY ("stock_symbol") REFERENCES "Stock"("stock_symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_stock_symbol_fkey" FOREIGN KEY ("stock_symbol") REFERENCES "Stock"("stock_symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DividendReceived" ADD CONSTRAINT "DividendReceived_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DividendReceived" ADD CONSTRAINT "DividendReceived_dividend_id_fkey" FOREIGN KEY ("dividend_id") REFERENCES "Dividend"("dividend_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCredit" ADD CONSTRAINT "TaxCredit_received_id_fkey" FOREIGN KEY ("received_id") REFERENCES "DividendReceived"("received_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTaxInfo" ADD CONSTRAINT "UserTaxInfo_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_stock_symbol_fkey" FOREIGN KEY ("stock_symbol") REFERENCES "Stock"("stock_symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_stock_symbol_fkey" FOREIGN KEY ("stock_symbol") REFERENCES "Stock"("stock_symbol") ON DELETE RESTRICT ON UPDATE CASCADE;
