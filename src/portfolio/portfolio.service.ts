import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Portfolio as PortfolioModel } from './portfolio.model'; // 💡 ต้องสร้าง PortfolioModel

@Injectable()
export class PortfolioService {
  constructor(private prisma: PrismaService) {}

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
  // 2. เมธอดสำหรับดึงข้อมูล Portfolio ปัจจุบันของ User
  // ********************************************************

  /**
   * ดึงรายการ Portfolio ปัจจุบันทั้งหมดของผู้ใช้
   */
  async findUserPortfolio(userId: string): Promise<PortfolioModel[]> {
    const portfolio = await this.prisma.portfolio.findMany({
      where: { user_id: userId, current_quantity: { gt: 0 } }, // ดึงเฉพาะหุ้นที่ยังถืออยู่
      orderBy: { stock_symbol: 'asc' },
      // include: { stock: true } // อาจรวมข้อมูลหุ้นด้วย
    });

    return portfolio as PortfolioModel[];
  }
}
