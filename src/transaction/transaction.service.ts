import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
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

@Injectable()
export class TransactionService {
  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
  ) {}

  /**
   * สร้างรายการซื้อ/ขายหุ้น และอัปเดต Portfolio ใน Transaction เดียวกัน
   */
  async createTransaction(
    data: TransactionInput,
    type: TransactionType, // 'BUY' | 'SELL'
  ): Promise<Transaction> {
    const {
      user_id,
      stock_symbol,
      quantity,
      price_per_share, // ราคาที่ผู้ใช้กรอก
      commission,
      transaction_date,
    } = data;

    // ตรวจสอบเบื้องต้น
    if (quantity <= 0 || price_per_share <= 0) {
      throw new BadRequestException(
        'Quantity and Price must be positive numbers.',
      );
    }

    // 1. ตรวจสอบว่ามีหุ้นในระบบหรือไม่
    const stock = await this.prisma.stock.findUnique({
      where: { stock_symbol },
    });
    if (!stock)
      throw new NotFoundException(`Stock symbol ${stock_symbol} not found.`);

    // ===============================================
    // 2. ดึงและยืนยันราคาย้อนหลัง (Validation)
    // ===============================================
    const transactionDateString = transaction_date.toString();

    let marketClosePrice: number;
    try {
      console.log(transactionDateString);
      marketClosePrice = await this.stockService.getPriceByDate(
        stock_symbol,
        transactionDateString,
      );
    } catch (error) {
      // ดักจับข้อผิดพลาดหากไม่พบราคา ณ วันนั้น (เช่น วันหยุดตลาด)
      console.log('error', error);
      throw new NotFoundException(
        `Market price not available for ${stock_symbol} on ${transactionDateString}.`,
      );
    }

    const priceTolerance = 0.05; // 5 สตางค์
    if (Math.abs(price_per_share - marketClosePrice) > priceTolerance) {
      console.log(
        `price_per_share:${price_per_share},marketClose:${marketClosePrice}`,
      );
      throw new BadRequestException(
        `Price per share (${price_per_share}) is outside the acceptable range of market price (${marketClosePrice}). Tolerance: ${priceTolerance} THB.`,
      );
    }

    // ประกาศตัวแปรสำหรับ Total Amount ที่คำนวณใหม่และ Realized P/L
    let calculatedTotalAmount: number;
    let realizedGainLoss: number | null = null;
    // ใช้ Prisma Transaction เพื่อให้มั่นใจว่าการบันทึกและอัปเดต Portfolio สำเร็จพร้อมกัน
    return this.prisma.$transaction(async (tx) => {
      // 3. ตรวจสอบ Portfolio เดิม
      const existingPortfolio = await tx.portfolio.findUnique({
        where: { user_id_stock_symbol: { user_id: user_id, stock_symbol } },
      });

      let newAverageCost = existingPortfolio?.average_cost || 0;
      let newQuantity = existingPortfolio?.current_quantity || 0;
      let newTotalInvested = existingPortfolio?.total_invested || 0;

      // 4. จัดการ Logic ตามประเภท Transaction (BUY/SELL)
      if (type === TransactionType.BUY) {
        // Cost = (ราคาหุ้น * จำนวน) + Commission
        const transactionCost = quantity * price_per_share + commission;
        calculatedTotalAmount = transactionCost; // กำหนดค่า Total Amount ที่ถูกต้อง
        // อัปเดต Total Invested และ Quantity
        newQuantity += quantity;
        newTotalInvested += transactionCost;
        // คำนวณต้นทุนเฉลี่ยใหม่ (Weighted Average Cost)
        newAverageCost = newTotalInvested / newQuantity;
      } else if (type === TransactionType.SELL) {
        if (newQuantity < quantity) {
          throw new BadRequestException(
            'Insufficient shares to sell in portfolio.',
          );
        }

        // Proceeds = (ราคาหุ้น * จำนวน) - Commission
        const transactionProceeds = quantity * price_per_share - commission;
        calculatedTotalAmount = transactionProceeds; // กำหนดค่า Total Amount ที่ถูกต้อง

        // คำนวณกำไร/ขาดทุนที่รับรู้ (Realized P/L)
        const costBasisSold = quantity * newAverageCost;
        realizedGainLoss = transactionProceeds - costBasisSold;

        console.log(
          `Realized P/L for ${stock_symbol} SELL: ${realizedGainLoss}`,
        );

        // อัปเดต Quantity
        newQuantity -= quantity;

        // ลด Total Invested ตาม Cost Basis ที่ขายไป
        newTotalInvested -= costBasisSold;

        // ถ้าขายหมด ต้องรีเซ็ต Total Invested และ Average Cost
        if (newQuantity === 0) {
          newTotalInvested = 0;
          newAverageCost = 0;
        } else if (newTotalInvested < 0) {
          // ป้องกัน Total Invested เป็นค่าลบจากการปัดเศษ
          newTotalInvested = 0;
        }
      }

      // 5. บันทึก Transaction
      const transactionDateForPrisma = new Date(transaction_date);

      if (isNaN(transactionDateForPrisma.getTime())) {
        throw new InternalServerErrorException(
          'Failed to parse date for database.',
        );
      }

      const transactionRecord = (await tx.transaction.create({
        data: {
          ...data,
          // 💡 ใช้ calculatedTotalAmount ที่คำนวณถูกต้องแล้ว
          total_amount: calculatedTotalAmount,
          transaction_date: transactionDateForPrisma,
          user_id: user_id,
          transaction_type: type,
        },
      })) as Transaction;
      // 6. อัปเดต/สร้าง Portfolio
      if (newQuantity === 0 && existingPortfolio) {
        // ถ้าขายหมด ให้ลบรายการออกจาก Portfolio
        await tx.portfolio.delete({
          where: { user_id_stock_symbol: { user_id: user_id, stock_symbol } },
        });
      } else {
        await tx.portfolio.upsert({
          where: { user_id_stock_symbol: { user_id: user_id, stock_symbol } },
          update: {
            current_quantity: newQuantity,
            total_invested: newTotalInvested,
            average_cost: newAverageCost,
            last_transaction_date: transactionDateForPrisma,
          },
          create: {
            user_id: user_id,
            stock_symbol: stock_symbol,
            current_quantity: newQuantity,
            total_invested: newTotalInvested,
            average_cost: newAverageCost,
            last_transaction_date: transactionDateForPrisma,
          },
        });
      }

      return transactionRecord;
    });
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
}
