import {
  Injectable,Inject,forwardRef,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  Portfolio as PortfolioModel,
  PortfolioSummary,
  PortfolioDetail,
  UpcomingDividend,
} from './portfolio.model'; // 💡 ต้องสร้าง PortfolioModel
import { StockService } from 'src/stock/stock.service';
import { DividendService } from 'src/dividend/dividend.service';

@Injectable()
export class PortfolioService {
  constructor(
    private prisma: PrismaService,
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
          lte: targetDate, // 💡 น้อยกว่าหรือเท่ากับวันเป้าหมาย
        },
      },
      // 💡 เลือกเฉพาะฟิลด์ที่จำเป็นเพื่อลดภาระ DB
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
      // 💡 อาจต้องมีการโยน Error หรือ Log เพื่อตรวจสอบข้อมูลที่ไม่ถูกต้อง
      console.error(
        `[PortfolioService] Negative share count (${netShares}) found for ${userId}/${stockSymbol} on ${targetDate.toISOString()}`,
      );
      return 0;
    }

    return netShares;
  }

  // ********************************************************
  // 2. (ใหม่) ดึงภาพรวมสรุปการลงทุน (Total Summary)
  // ********************************************************
  async getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
    const portfolioRecords = await this.findUserPortfolio(userId);
    let totalMarketValue = 0;
    let totalInvested = 0;
    // ต้องดึงราคาปัจจุบันของหุ้นทั้งหมด
    const symbols = portfolioRecords.map((p) => p.stock_symbol);
    const currentPrices = await this.stockService.getCurrentPrices(symbols);

    for (const record of portfolioRecords) {
      const currentPrice = currentPrices[record.stock_symbol] || 0;
      const marketValue = record.current_quantity * currentPrice;
      totalMarketValue += marketValue;
      totalInvested += record.total_invested;
    }

    const totalProfitLoss = totalMarketValue - totalInvested;
    const totalReturnPercent =
      totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0; //เปอร์เซนผลตอบแทนรวม

    return {
      total_market_value: parseFloat(totalMarketValue.toFixed(2)),
      total_invested: parseFloat(totalInvested.toFixed(2)),
      total_profit_loss: parseFloat(totalProfitLoss.toFixed(2)),
      total_return_percent: parseFloat(totalReturnPercent.toFixed(2)),
    };
  }
  // ********************************************************
  // 3. (ปรับปรุง) ดึงรายละเอียดหุ้นในพอร์ต (Detail Table)
  // ********************************************************
  async getPortfolioDetails(userId: string): Promise<PortfolioDetail[]> {
    const portfolioRecords = await this.findUserPortfolio(userId);

    const symbols = portfolioRecords.map((p) => p.stock_symbol);
    const currentPrices = await this.stockService.getCurrentPrices(symbols);

    return portfolioRecords.map((record) => {
      const currentPrice = currentPrices[record.stock_symbol] || 0;
      const marketValue = record.current_quantity * currentPrice;
      const costBasis = record.current_quantity * record.average_cost;

      const profitLoss = marketValue - costBasis;
      const returnPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

      return {
        ...record,
        current_price: parseFloat(currentPrice.toFixed(2)),
        market_value: parseFloat(marketValue.toFixed(2)),
        profit_loss: parseFloat(profitLoss.toFixed(2)),
        return_percent: parseFloat(returnPercent.toFixed(2)),
      } as PortfolioDetail;
    });
  }

  // ********************************************************
  // 4. (ใหม่) ดึงปันผลที่คาดว่าจะได้รับเร็วๆนี้
  // ********************************************************
  async getUpcomingDividends(userId: string): Promise<UpcomingDividend[]> {
    const records = await this.dividendService.findUpcomingDividends(10);

    const upcomingDividends: UpcomingDividend[] = [];

    for (const div of records) {
      // 💡 ใช้ getSharesHeldOnDate เพื่อตรวจสอบสิทธิ์ในวัน Record Date
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
  // 5. (เดิม) เมธอดดั้งเดิมสำหรับดึงข้อมูล Portfolio ปัจจุบัน
  // ********************************************************
  async findUserPortfolio(userId: string): Promise<PortfolioModel[]> {
    const portfolio = await this.prisma.portfolio.findMany({
      where: { user_id: userId, current_quantity: { gt: 0 } },
      orderBy: { stock_symbol: 'asc' },
    });
    return portfolio as PortfolioModel[];
  }
}
