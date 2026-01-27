import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  Portfolio as PortfolioModel,
  PortfolioSummary,
  PortfolioDetail,
  UpcomingDividend,
  PortfolioHistoryPoint,
  AllocationItem,
} from './portfolio.model';
import { StockService } from 'src/stock/stock.service';
import { DividendService } from 'src/dividend/dividend.service';
import { getStartDateFromInterval } from 'src/utils/time-interval-utils';

@Injectable()
export class PortfolioService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => StockService))
    private stockService: StockService, //Inject Service ราคาหุ้น
    @Inject(forwardRef(() => DividendService)) //forwardRef ใช้เมื่อเกิด Circular Dependency คือสถานการณ์ที่ Module สองตัวขึ้นไปพึ่งพา (Import) ซึ่งกันและกันโดยตรงหรือโดยอ้อม ทำให้ NestJS ไม่สามารถกำหนดลำดับการเริ่มต้น
    private dividendService: DividendService,
  ) {}

  // ********************************************************
  // 1. เมธอดสำคัญ: คำนวณจำนวนหุ้นที่ถือครอง ณ วันที่กำหนด (Used by DividendService)
  // ********************************************************
  /**
   * คำนวณจำนวนหุ้นสุทธิที่ผู้ใช้ถือครอง ณ วันที่เป้าหมาย โดยอ้างอิงจากประวัติ Transaction
   * @param userId ID ผู้ใช้
   * @param stockSymbol สัญลักษณ์หุ้น
   * @param targetDate วันที่เป้าหมาย (เช่น Record Date)
   * @returns จำนวนหุ้นสุทธิที่ถือครอง ณ วันนั้น
   */
  async getSharesHeldOnDate(
    userId: string,
    stockSymbol: string,
    targetDate: Date,
  ): Promise<number> {
    // 1. ดึงรายการซื้อขายทั้งหมดจนถึงวันเป้าหมาย (รวมวันเป้าหมายด้วย)
    const transactions = await this.prisma.transaction.findMany({
      where: {
        user_id: userId,
        stock_symbol: stockSymbol,
        transaction_date: {
          lte: targetDate, //น้อยกว่าหรือเท่ากับวันเป้าหมาย
        },
      },
      select: {
        quantity: true,
        transaction_type: true,
      },
    });

    if (transactions.length === 0) {
      return 0; // ไม่มีรายการซื้อขายเลย
    }

    // 2. คำนวณยอดสุทธิ (Net Shares)
    // Buy = +, Sell = -
    const netShares = transactions.reduce((sum, tx) => {
      if (tx.transaction_type === 'BUY') {
        return sum + tx.quantity;
      } else if (tx.transaction_type === 'SELL') {
        return sum - tx.quantity;
      }
      return sum;
    }, 0);

    // 3. ตรวจสอบว่าจำนวนหุ้นไม่ติดลบ (ในกรณีที่ Logic Transaction ถูกต้อง)
    if (netShares < 0) {
      console.error(
        `[PortfolioService] Negative share count (${netShares}) found for ${userId}/${stockSymbol} on ${targetDate.toISOString()}`,
      );
      return 0;
    }

    return netShares;
  }

  // ********************************************************
  // 2.ดึงภาพรวมสรุปการลงทุน (Total Summary)
  // ********************************************************
  async getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
    const portfolioRecords = await this.findUserPortfolio(userId);
    let totalMarketValue = 0;
    let totalInvested = 0;
    //1.ต้องดึงราคาปัจจุบันของหุ้นทั้งหมด
    const symbols = portfolioRecords.map((p) => p.stock_symbol);
    const currentPrices = await this.stockService.getCurrentPrices(symbols);

    for (const record of portfolioRecords) {
      const currentPrice = currentPrices[record.stock_symbol] || 0;
      const marketValue = record.current_quantity * currentPrice;
      totalMarketValue += marketValue;
      totalInvested += record.total_invested;
    }
    //2.คำนวณกำไร/ขาดทุน (Market P/L)
    const totalProfitLoss = totalMarketValue - totalInvested;

    //3.ดึงและคำนวณผลรวมปันผลและเครดิตภาษีที่ได้รับ
    const receivedHistory =
      await this.dividendService.findReceivedHistory(userId);

    let totalReceivedDividends = 0; // ปันผลสุทธิ (Net Dividend)
    let totalTaxCredit = 0; // เครดิตภาษี (Tax Credit)

    for (const record of receivedHistory) {
      //record.net_received_amount คือปันผลสุทธิที่ได้รับ
      totalReceivedDividends += record.net_dividend_received;

      //ต้องตรวจสอบว่า taxCredit มีค่าอยู่หรือไม่ ก่อนดึง amount
      if (record.taxCredit) {
        totalTaxCredit += record.taxCredit.tax_credit_amount;
      }
    }

    // 4. คำนวณผลตอบแทนสุทธิรวมทั้งหมด
    const totalNetReturn =
      totalProfitLoss + totalReceivedDividends + totalTaxCredit;

    // 5. คำนวณเปอร์เซ็นต์ผลตอบแทนสุทธิรวม
    const netReturnPercent =
      totalInvested > 0 ? (totalNetReturn / totalInvested) * 100 : 0;
    // -----------------------------------------------------------------

    return {
      total_market_value: parseFloat(totalMarketValue.toFixed(2)),
      total_invested: parseFloat(totalInvested.toFixed(2)),
      total_profit_loss: parseFloat(totalProfitLoss.toFixed(2)),

      total_received_dividends: parseFloat(totalReceivedDividends.toFixed(2)),
      total_tax_credit: parseFloat(totalTaxCredit.toFixed(2)),
      total_net_return: parseFloat(totalNetReturn.toFixed(2)),
      net_return_percent: parseFloat(netReturnPercent.toFixed(2)),
    };
  }
  // ********************************************************
  // 3.ดึงรายละเอียดหุ้นในพอร์ต (Detail Table)
  // ********************************************************
  async getPortfolioDetails(userId: string): Promise<PortfolioDetail[]> {
    const portfolioRecords = await this.findUserPortfolio(userId);

    const symbols = portfolioRecords.map((p) => p.stock_symbol);
    const currentPrices = await this.stockService.getCurrentPrices(symbols);

    //Dividend Calculate
    const receivedHistory =
      await this.dividendService.findReceivedHistory(userId);
    // Map เพื่อเก็บยอดรวมปันผล/เครดิตภาษี แยกตาม Stock Symbol
    const dividendMap = new Map<string, number>();
    for (const record of receivedHistory) {
      if (!record.dividend) {
        continue;
      }
      const symbol = record.dividend.stock_symbol; // ดึง symbol จากความสัมพันธ์
      const netDividend = record.net_dividend_received;
      // const taxCredit = record.taxCredit
      //   ? record.taxCredit.tax_credit_amount
      //   : 0;

      // ยอดรวม = ปันผลสุทธิ (ใช้เพื่อแสดงในคอลัมน์ "เงินปันผลได้รับ")
      const totalDividendForRecord = netDividend;

      const currentTotal = dividendMap.get(symbol) || 0;
      console.log(`symbol ${symbol},currentTotal ${currentTotal}`);
      dividendMap.set(symbol, currentTotal + totalDividendForRecord); //สะสมยอดรวมแต่ละหุ้น
    }

    return portfolioRecords.map((record) => {
      const currentSymbol = record.stock_symbol;

      const currentPrice = currentPrices[record.stock_symbol] || 0;
      const marketValue = record.current_quantity * currentPrice;
      const costBasis = record.current_quantity * record.average_cost;

      const profitLoss = marketValue - costBasis;
      const returnPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

      const receivedDividendTotal = dividendMap.get(currentSymbol) || 0;

      return {
        ...record,
        current_price: parseFloat(currentPrice.toFixed(2)),
        market_value: parseFloat(marketValue.toFixed(2)),
        profit_loss: parseFloat(profitLoss.toFixed(2)),
        return_percent: parseFloat(returnPercent.toFixed(2)),
        received_dividend_total: parseFloat(receivedDividendTotal.toFixed(2)),
      } as PortfolioDetail;
    });
  }

  // ********************************************************
  // 4.ดึงปันผลที่คาดว่าจะได้รับเร็วๆนี้
  // ********************************************************
  async getUpcomingDividends(userId: string): Promise<UpcomingDividend[]> {
    const records = await this.dividendService.findUpcomingDividends(10);

    // const testDate = new Date('2025-01-01');
    // const records = await this.dividendService.findUpcomingDividendsTest(
    //   10,
    //   testDate,
    // );
    console.log(records);

    const upcomingDividends: UpcomingDividend[] = [];

    for (const div of records) {
      // ใช้ getSharesHeldOnDate เพื่อตรวจสอบสิทธิ์ในวัน Record Date
      const sharesAtRecordDate = await this.getSharesHeldOnDate(
        userId,
        div.stock_symbol,
        div.record_date,
      );

      if (sharesAtRecordDate > 0) {
        const estimatedGrossDividend =
          sharesAtRecordDate * div.dividend_per_share;

        upcomingDividends.push({
          stock_symbol: div.stock_symbol,
          ex_dividend_date: div.ex_dividend_date,
          record_date: div.record_date,
          payment_date: div.payment_date,
          shares_eligible: sharesAtRecordDate,
          estimated_dividend: parseFloat(estimatedGrossDividend.toFixed(2)),
        });
      }
    }

    return upcomingDividends;
  }

  // ********************************************************
  // 5.เมธอดดั้งเดิมสำหรับดึงข้อมูล Portfolio ปัจจุบัน
  // ********************************************************
  async findUserPortfolio(userId: string): Promise<PortfolioModel[]> {
    const portfolio = await this.prisma.portfolio.findMany({
      where: { user_id: userId, current_quantity: { gt: 0 } },
      orderBy: { stock_symbol: 'asc' },
    });
    return portfolio as PortfolioModel[];
  }

  // ********************************************************
  // 6. ดึงประวัติมูลค่าพอร์ต (Line Chart Data)
  // ********************************************************
  async getPortfolioHistory(
    userId: string,
    interval: '1W' | '1M' | '3M' | '6M' | '1Y' = '1M',
  ): Promise<PortfolioHistoryPoint[]> {
    // 1. กำหนดช่วงเวลาสำหรับแสดงผลลัพธ์ (Display Range)
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const displayStartDate = getStartDateFromInterval(interval);
    displayStartDate.setHours(0, 0, 0, 0);

    // 2. ดึง Transaction ทั้งหมดของผู้ใช้ตั้งแต่เริ่มต้น (จำเป็นต่อการคำนวณ Cost Basis)
    const allTransactions = await this.prisma.transaction.findMany({
      where: { user_id: userId },
      orderBy: { transaction_date: 'asc' }, // เรียงตามวันที่เก่าไปใหม่
      select: {
        stock_symbol: true,
        quantity: true,
        price_per_share: true,
        transaction_date: true,
        transaction_type: true,
      },
    });

    if (allTransactions.length === 0) {
      return []; // ไม่มีประวัติการซื้อขาย
    }

    const firstTxDate = new Date(allTransactions[0].transaction_date);
    firstTxDate.setHours(0, 0, 0, 0);

    // 3. ดึงราคาปิดย้อนหลังของหุ้นทั้งหมด (ตั้งแต่ Transation แรกสุดจนถึงวันนี้)
    const allSymbols = Array.from(
      new Set(allTransactions.map((tx) => tx.stock_symbol)),
    );
    // 3a. สร้าง Array ของ Promises สำหรับการดึงข้อมูลแต่ละ Symbol
    const pricePromises = allSymbols.map((symbol) =>
      this.stockService.getHistoricalPrices(symbol, firstTxDate, endDate),
    );
    // 3b. เรียกใช้ทั้งหมดพร้อมกัน
    const allPricesArray = await Promise.all(pricePromises);
    // 3c. จัดโครงสร้างข้อมูลใหม่ให้อยู่ในรูปแบบ Map ที่ง่ายต่อการเข้าถึง (symbol -> date -> price)
    // Output Structure: { 'AOT': { 'YYYY-MM-DD': close_price, ... }, 'ADVANC': { ... } }
    const historicalPricesMap: Record<string, Record<string, number>> = {};

    allPricesArray.forEach((prices, index) => {
      const symbol = allSymbols[index];
      const datePriceMap: Record<string, number> = {};
      // แปลง Array ของ HistoricalPrice ให้เป็น Map (dateString -> close_price)
      prices.forEach((priceRecord) => {
        const priceDateObject = new Date(priceRecord.price_date);
        const dateString = priceDateObject.toISOString().split('T')[0];
        //console.log(dateString);
        datePriceMap[dateString] = priceRecord.close_price;
      });

      historicalPricesMap[symbol] = datePriceMap;
    });

    // 4. Loop ผ่านทุกวันตั้งแต่ Transaction แรกเพื่อคำนวณสถานะสะสม
    const history: PortfolioHistoryPoint[] = [];
    const currentShares: { [symbol: string]: number } = {}; // จำนวนหุ้นที่ถือครอง ณ สิ้นวันก่อนหน้า
    const currentCostBasis: { [symbol: string]: number } = {}; // ต้นทุนสะสม ณ สิ้นวันก่อนหน้า
    let txIndex = 0; // Index สำหรับ Transactions

    const currentDate = firstTxDate;

    while (currentDate <= endDate) {
      // แปลงวันที่เป็น String format YYYY-MM-DD เพื่อใช้ค้นหาราคา
      const dateString = currentDate.toISOString().split('T')[0];

      let dailyMarketValue = 0;
      let dailyCostBasis = 0;

      //เก็บ Index ก่อน Loop เพื่อตรวจสอบว่ามีการทำ Transaction ในวันนี้หรือไม่
      const startingTxIndex = txIndex;

      // 4a. ประมวลผล Transaction ที่เกิดขึ้นในวันนี้
      while (
        txIndex < allTransactions.length &&
        allTransactions[txIndex].transaction_date
          .toISOString()
          .split('T')[0] === dateString
      ) {
        const tx = allTransactions[txIndex];
        const symbol = tx.stock_symbol;
        const isBuy = tx.transaction_type === 'BUY';
        const costImpact = tx.quantity * tx.price_per_share;

        const sharesBeforeTx = currentShares[symbol] || 0;
        const costBeforeTx = currentCostBasis[symbol] || 0;

        // 1. อัปเดตจำนวนหุ้น
        currentShares[symbol] =
          sharesBeforeTx + (isBuy ? tx.quantity : -tx.quantity);

        // 2. อัปเดตต้นทุนสะสม (Average Cost Method)
        if (isBuy) {
          currentCostBasis[symbol] = costBeforeTx + costImpact;
        } else {
          // SELL
          // คำนวณต้นทุนเฉลี่ยก่อนขาย
          const avgCost =
            sharesBeforeTx > 0 ? costBeforeTx / sharesBeforeTx : 0;
          // ลบต้นทุนตามจำนวนที่ขายออก
          currentCostBasis[symbol] = costBeforeTx - tx.quantity * avgCost;
        }

        // จัดการกรณีที่หุ้นหมดพอร์ตหรือเกิดค่าผิดพลาดจากการคำนวณ
        if (currentShares[symbol] <= 0) {
          currentShares[symbol] = 0;
          currentCostBasis[symbol] = 0;
        } else if (currentCostBasis[symbol] < 0) {
          // ป้องกันต้นทุนติดลบเนื่องจาก Floating Point Error หรือ logic
          currentCostBasis[symbol] = 0;
        }

        txIndex++;
      }

      // 4b. คำนวณมูลค่าตลาดรวม ณ สิ้นวันนี้
      for (const symbol of allSymbols) {
        const shares = currentShares[symbol] || 0;
        const cost = currentCostBasis[symbol] || 0;

        // ดึงราคาปิดของวันนี้ (ถ้าไม่มีราคาวันนี้ ให้ใช้ราคา 0 หรือราคาปิดล่าสุดก่อนหน้า,
        // ซึ่งตรงนี้ขึ้นอยู่กับการ Implement historicalPricesMap)
        const price = historicalPricesMap[symbol]?.[dateString] || 0;

        dailyMarketValue += shares * price;
        dailyCostBasis += cost;
      }

      const transactionHappenedToday = txIndex > startingTxIndex;

      // 4c. บันทึกผลลัพธ์ของวันนี้ (เฉพาะวันที่อยู่ในช่วง Display Range)
      if (currentDate >= displayStartDate) {
        // Include point ถ้าเป็นวันที่มีการซื้อขาย (transactionHappenedToday)
        // หรือ Market Value > 0 (วันซื้อขายปกติที่มีราคา)
        if (dailyMarketValue > 0 || transactionHappenedToday) {
          history.push({
            history_date: new Date(currentDate),
            market_value: parseFloat(dailyMarketValue.toFixed(2)),
            cost_basis: parseFloat(dailyCostBasis.toFixed(2)),
          });
        }
      }

      // 4d. เลื่อนไปวันถัดไป
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return history;
  }

  // ********************************************************
  // 7. ดึงการกระจายการลงทุน (Pie Chart Data)
  // ********************************************************
  async getAllocation(userId: string): Promise<AllocationItem[]> {
    const portfolioRecords = await this.findUserPortfolio(userId);
    const symbols = portfolioRecords.map((p) => p.stock_symbol);
    if (symbols.length === 0) {
      return [];
    }
    const currentPrices = await this.stockService.getCurrentPrices(symbols);
    // 1b. สร้าง Array ของ Promises สำหรับการเรียก getStockData ทีละ Symbol
    const stockDataPromises = symbols.map(
      (symbol) => this.stockService.getStockData(symbol), // สมมติว่าเมธอดนี้คืนค่า Object ที่มี field 'sector'
    );
    // 1c. รัน Promise ทั้งหมดพร้อมกัน
    const allStockData = await Promise.all(stockDataPromises);

    // 1d. จัดโครงสร้างข้อมูล Sector ให้เป็น Map เพื่อความง่ายในการเข้าถึง (Symbol -> Data Object)
    type StockData = Awaited<ReturnType<typeof this.stockService.getStockData>>;

    const stockInfoMap: Record<string, StockData> = {};
    allStockData.forEach((data, index) => {
      const symbol = symbols[index];
      stockInfoMap[symbol] = data;
    });
    const allocationMap = new Map<string, number>();
    let totalMarketValue = 0;

    // 2. คำนวณมูลค่าตลาดตาม Sector
    for (const record of portfolioRecords) {
      const symbol = record.stock_symbol;
      const currentPrice = currentPrices[symbol] || 0;
      const marketValue = record.current_quantity * currentPrice;

      //ดึง Sector (ถ้าไม่มี ให้ใช้ "Unknown Sector")
      const sectorName = stockInfoMap[symbol]?.sector || 'Unknown Sector';

      //สะสมยอดรวมมูลค่าตลาดรวมทั้งหมด
      totalMarketValue += marketValue;

      //สะสมยอดมูลค่าตลาดแยกตาม Sector
      allocationMap.set(
        sectorName,
        (allocationMap.get(sectorName) || 0) + marketValue,
      );
    }

    // 4. แปลง Map เป็น Array Output (AllocationItem[])
    const allocationArray: AllocationItem[] = [];
    for (const [sectorName, value] of allocationMap.entries()) {
      const percentage =
        totalMarketValue > 0 ? (value / totalMarketValue) * 100 : 0;

      allocationArray.push({
        sector: sectorName,
        market_value: parseFloat(value.toFixed(2)),
        percentage: parseFloat(percentage.toFixed(1)),
      });
    }

    // เรียงลำดับจากมูลค่ามากไปน้อย เพื่อให้ Pie Chart อ่านง่าย
    return allocationArray.sort((a, b) => b.market_value - a.market_value);
  }
}
