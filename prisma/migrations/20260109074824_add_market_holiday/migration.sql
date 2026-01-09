-- CreateTable
CREATE TABLE "MarketHoliday" (
    "holiday_date" DATE NOT NULL,
    "description" TEXT DEFAULT 'Market Closed / No Data',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketHoliday_pkey" PRIMARY KEY ("holiday_date")
);
