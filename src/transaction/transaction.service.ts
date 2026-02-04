import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from './../prisma.service';
import { StockService } from './../stock/stock.service';
import { Prisma } from '@prisma/client';
import {
  Transaction,
  TransactionFilters,
  TransactionInput,
  TransactionType,
} from './transaction.model';
import { DividendService } from 'src/dividend/dividend.service';
import { PortfolioService } from 'src/portfolio/portfolio.service';

interface PredictionData {
  dividend_id: string;
  stock_symbol: string;
  prediction_date: Date;
  ex_dividend_date: Date;
  record_date: Date | null;
  payment_date: Date | null;
  dividend_per_share: number | null;
}

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);
  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
    @Inject(forwardRef(() => DividendService))
    private dividendService: DividendService,
    @Inject(forwardRef(() => PortfolioService))
    private portfolioService: PortfolioService,
  ) {}

  /**
   * สร้างรายการซื้อ/ขายหุ้น และอัปเดต Portfolio ใน Transaction เดียวกัน
   */
  async createTransaction(
    data: TransactionInput,
    type: TransactionType,
  ): Promise<Transaction> {
    const {
      user_id,
      stock_symbol,
      quantity,
      price_per_share,
      commission,
      transaction_date,
    } = data;

    // --- ส่วนที่ 1: Validation (เหมือนเดิม) ---
    if (quantity <= 0 || price_per_share <= 0) {
      throw new BadRequestException(
        'Quantity and Price must be positive numbers.',
      );
    }

    const stock = await this.prisma.stock.findUnique({
      where: { stock_symbol },
    });
    if (!stock)
      throw new NotFoundException(`Stock symbol ${stock_symbol} not found.`);

    const marketClosePrice = await this.stockService.getPriceByDate(
      stock_symbol,
      transaction_date.toString(),
    );

    const priceTolerance = 0.05;
    if (Math.abs(price_per_share - marketClosePrice) > priceTolerance) {
      throw new BadRequestException(`Price outside acceptable range.`);
    }

    // --- ส่วนที่ 2: ดำเนินการใน Database (Prisma Transaction) ---
    // เราจะเก็บผลลัพธ์ไว้ในตัวแปร result เพื่อ return ออกไปในตอนท้าย
    const result = await this.prisma.$transaction(async (tx) => {
      const existingPortfolio = await tx.portfolio.findUnique({
        where: { user_id_stock_symbol: { user_id, stock_symbol } },
      });

      let newAverageCost = existingPortfolio?.average_cost || 0;
      let newQuantity = existingPortfolio?.current_quantity || 0;
      let newTotalInvested = existingPortfolio?.total_invested || 0;
      let calculatedTotalAmount = 0;

      if (type === TransactionType.BUY) {
        const transactionCost = quantity * price_per_share + commission;
        calculatedTotalAmount = transactionCost;
        newQuantity += quantity;
        newTotalInvested += transactionCost;
        newAverageCost = newTotalInvested / newQuantity;
      } else if (type === TransactionType.SELL) {
        // 1. เช็คหุ้นที่มี "ณ วันที่ขาย" (Backdate Check)
        const sharesOnDate = await this.portfolioService.getSharesHeldOnDate(
          user_id,
          stock_symbol,
          new Date(transaction_date),
        );
        if (sharesOnDate < quantity) {
          throw new BadRequestException(
            `ยอดหุ้นไม่พอขายในวันที่ระบุ: ณ วันที่ ${new Date(transaction_date).toLocaleDateString()} คุณมีหุ้นเพียง ${sharesOnDate} หุ้น`,
          );
        }
        // 2. เช็คหุ้นที่มี "ปัจจุบัน" (Overall Check - กันกรณีขายเกินพอร์ตล่าสุด)
        if (newQuantity < quantity)
          throw new BadRequestException('จำนวนหุ้นไม่เพียงพอต่อการขาย');
        const transactionProceeds = quantity * price_per_share - commission;
        calculatedTotalAmount = transactionProceeds;
        const costBasisSold = quantity * newAverageCost;
        newQuantity -= quantity;
        newTotalInvested -= costBasisSold;
        if (newQuantity === 0) {
          newTotalInvested = 0;
          newAverageCost = 0;
        }
      }

      const transactionDateForPrisma = new Date(transaction_date);

      // บันทึกรายการ
      const transactionRecord = await tx.transaction.create({
        data: {
          ...data,
          total_amount: calculatedTotalAmount,
          transaction_date: transactionDateForPrisma,
          user_id: user_id,
          transaction_type: type,
        },
      });

      // อัปเดต Portfolio
      if (newQuantity === 0 && existingPortfolio) {
        await tx.portfolio.delete({
          where: { user_id_stock_symbol: { user_id, stock_symbol } },
        });
      } else {
        await tx.portfolio.upsert({
          where: { user_id_stock_symbol: { user_id, stock_symbol } },
          update: {
            current_quantity: newQuantity,
            total_invested: newTotalInvested,
            average_cost: newAverageCost,
            last_transaction_date: transactionDateForPrisma,
          },
          create: {
            user_id,
            stock_symbol,
            current_quantity: newQuantity,
            total_invested: newTotalInvested,
            average_cost: newAverageCost,
            last_transaction_date: transactionDateForPrisma,
          },
        });
      }

      return transactionRecord as Transaction; // คืนค่าออกไปหาตัวแปร result
    });

    // --- ส่วนที่ 3: Sync ปันผล (อยู่นอก Transaction เพื่อให้เห็นข้อมูลที่ Commit แล้ว) ---
    try {
      await this.syncDividendAfterTrade(
        user_id,
        stock_symbol,
        new Date(transaction_date),
      );
    } catch (error) {
      console.error(`Dividend Sync Failed for ${stock_symbol}:`, error);
    }

    // คืนค่า Transaction
    return result;
  }

  // ===================================
  // NEW: ดึงรายการ Transaction ทั้งหมดของ User
  // ===================================
  async findAll(
    userId: string,
    filters: TransactionFilters,
  ): Promise<Transaction[]> {
    // 1. สร้างเงื่อนไขการค้นหา (Where Clause)
    const where: Prisma.TransactionWhereInput = {
      user_id: userId,
    };

    // 2. ถ้ามีการส่ง symbol มา ให้เพิ่มเงื่อนไขการกรองด้วยสัญลักษณ์หุ้น
    if (filters.symbol) {
      where.stock_symbol = filters.symbol;
    }
    // 3. ถ้ามีการส่ง type มา ให้เพิ่มเงื่อนไขการกรองด้วย transaction_type
    if (filters.type) {
      where.transaction_type = filters.type.toUpperCase();
    }
    // 4. ใช้ Prisma เพื่อดึงข้อมูล
    const transactions = await this.prisma.transaction.findMany({
      where: where,
      orderBy: {
        transaction_date: 'desc',
      },
      // หากต้องการข้อมูลความสัมพันธ์ (เช่น ชื่อหุ้น) ให้ใช้ include
      // include: {
      //   stock: true,
      // },
    });

    // 5. เนื่องจากเราใช้ Transaction Model ที่กำหนดเอง
    // และ Prisma return Type ที่เข้ากันได้ เราสามารถ return ได้โดยตรง
    return transactions as Transaction[];
  }

  async findOne(transactionId: string, userId: string): Promise<Transaction> {
    const transaction = await this.prisma.transaction.findUnique({
      where: {
        transaction_id: transactionId,
        user_id: userId,
      },
    });

    if (!transaction) {
      // หากไม่พบ อาจเป็นเพราะ ID ไม่ถูกต้อง หรือ ID เป็นของ User คนอื่น
      throw new NotFoundException(
        `Transaction with ID ${transactionId} not found.`,
      );
    }
    return {
      ...transaction,
      transaction_type: transaction.transaction_type as TransactionType,
    } as Transaction;
  }

  /**
   * ฟังก์ชันช่วยในการตัดสินใจว่าจะ Sync แบบ Actual หรือ Predict
   */
  private async syncDividendAfterTrade(
    userId: string,
    symbol: string,
    transactionDateString: Date,
  ) {
    // 1. หา "รอบปันผลที่ใกล้ที่สุด" ที่ User ควรจะได้จากการซื้อครั้งนี้
    const nearDividend = await this.dividendService.findNearFutureDividend(
      symbol,
      transactionDateString,
    );

    if (!nearDividend) {
      this.logger.log(
        `No upcoming dividend or prediction found for ${symbol}.`,
      );
      return;
    }

    // 2. เรียกใช้ฟังก์ชันคำนวณและบันทึก (Upsert)
    // โดยส่ง Parameter ให้ตรงตามประเภทที่หาได้
    if (nearDividend.type === 'ACTUAL') {
      await this.dividendService.calculateAndCreateReceivedDividends({
        userId: userId,
        dividendId: nearDividend.data.dividend_id,
      });
    } else if (nearDividend.type === 'PREDICTED') {
      const predictionData = nearDividend.data as PredictionData;
      console.log(predictionData);

      await this.dividendService.calculateAndCreateReceivedDividends({
        userId: userId,
        predictionId: {
          symbol: symbol,
          date: new Date(predictionData.ex_dividend_date).toISOString(),
        },
      });
    }
  }
}
