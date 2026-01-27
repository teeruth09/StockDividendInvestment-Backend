import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import {
  PortfolioSummary,
  PortfolioDetail,
  UpcomingDividend,
  PortfolioHistoryPoint,
  AllocationItem, // Import Model ที่สร้างไว้
} from './portfolio.model';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserId } from 'src/auth/decorators/user-id.decorator';
// import { CurrentUser } from '../auth/current-user.decorator';

@Controller('portfolio')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  // 1. ภาพรวมสรุปการลงทุน (Summary)
  /**
   * ดึงผลสรุปการลงทุนทั้งหมด (มูลค่าตลาดรวม, กำไร/ขาดทุนรวม)
   */
  @Get('/summary')
  async getSummary(
    @UserId() userId: string, //ดึง ID จาก JWT Token Payload
  ): Promise<PortfolioSummary> {
    return this.portfolioService.getPortfolioSummary(userId);
  }

  // 2. หุ้นในพอร์ตโฟลิโอ (Details)
  /**
   * ดึงรายการหุ้นแต่ละตัวพร้อมสถานะ P/L และมูลค่าตลาด
   */
  @Get('/details')
  async getDetails(
    @UserId() userId: string, //ดึง ID จาก JWT Token Payload
  ): Promise<PortfolioDetail[]> {
    return this.portfolioService.getPortfolioDetails(userId);
  }

  // 3. ปันผลที่คาดว่าจะได้รับเร็วๆนี้
  /**
   * ดึงรายการปันผลที่ผู้ใช้มีสิทธิ์แต่ยังไม่ได้รับเงิน
   */
  @Get('/upcoming-dividends')
  async getUpcomingDividends(
    @UserId() userId: string, //ดึง ID จาก JWT Token Payload
  ): Promise<UpcomingDividend[]> {
    return this.portfolioService.getUpcomingDividends(userId);
  }

  // 4. (เพิ่มเติม) ดึงประวัติการปันผลที่ได้รับแล้ว
  // [GET] /portfolio/:userId/received-dividends
  /**
   * ดึงรายการปันผลที่ได้รับแล้วทั้งหมด
   */
  @Get(':userId/received-dividends')
  getReceivedDividends(@Param('userId') userId: string): any {
    // 💡 เมธอดนี้ควรถูก implement ใน PortfolioService (หรือเรียก DividendService)
    // ตัวอย่าง: return this.dividendService.getReceivedDividendsByUser(userId);
    return {
      message: 'Endpoint for received dividends implemented.',
      userId,
    };
  }
  // 5. ประวัติมูลค่าพอร์ต (Line Chart)
  @Get('/history')
  async getPortfolioHistory(
    @UserId() userId: string, //ดึง ID จาก JWT Token Payload
    @Query('interval') interval: '1W' | '1M' | '3M' | '6M' | '1Y' = '1M',
  ): Promise<PortfolioHistoryPoint[]> {
    return this.portfolioService.getPortfolioHistory(userId, interval);
  }
  // 6. การกระจายการลงทุน (Pie Chart)
  @Get('/allocation')
  async getAllocation(
    @UserId() userId: string, //ดึง ID จาก JWT Token Payload
  ): Promise<AllocationItem[]> {
    return this.portfolioService.getAllocation(userId);
  }
}
