import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import {
  PortfolioSummary,
  PortfolioDetail,
  UpcomingDividend, // Import Model ที่สร้างไว้
} from './portfolio.model';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { CurrentUser } from '../auth/current-user.decorator';

@Controller('portfolio')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  // ********************************************************
  // 1. ภาพรวมสรุปการลงทุน (Summary)
  // [GET] /portfolio/:userId/summary
  // ********************************************************
  /**
   * ดึงผลสรุปการลงทุนทั้งหมด (มูลค่าตลาดรวม, กำไร/ขาดทุนรวม)
   */
  @Get(':userId/summary')
  async getSummary(@Param('userId') userId: string): Promise<PortfolioSummary> {
    // ใช้ userId จาก Param หรือจาก Token
    return this.portfolioService.getPortfolioSummary(userId);
  }

  // ********************************************************
  // 2. หุ้นในพอร์ตโฟลิโอ (Details)
  // [GET] /portfolio/:userId/details
  // ********************************************************
  /**
   * ดึงรายการหุ้นแต่ละตัวพร้อมสถานะ P/L และมูลค่าตลาด
   */
  @Get(':userId/details')
  async getDetails(
    @Param('userId') userId: string,
  ): Promise<PortfolioDetail[]> {
    return this.portfolioService.getPortfolioDetails(userId);
  }

  // ********************************************************
  // 3. ปันผลที่คาดว่าจะได้รับเร็วๆนี้
  // [GET] /portfolio/:userId/upcoming-dividends
  // ********************************************************
  /**
   * ดึงรายการปันผลที่ผู้ใช้มีสิทธิ์แต่ยังไม่ได้รับเงิน
   */
  @Get(':userId/upcoming-dividends')
  async getUpcomingDividends(
    @Param('userId') userId: string,
  ): Promise<UpcomingDividend[]> {
    return this.portfolioService.getUpcomingDividends(userId);
  }

  // ********************************************************
  // 4. (เพิ่มเติม) ดึงประวัติการปันผลที่ได้รับแล้ว
  // [GET] /portfolio/:userId/received-dividends
  // ********************************************************
  /**
   * ดึงรายการปันผลที่ได้รับแล้วทั้งหมด
   */
  @Get(':userId/received-dividends')
  async getReceivedDividends(@Param('userId') userId: string): Promise<any> {
    // 💡 เมธอดนี้ควรถูก implement ใน PortfolioService (หรือเรียก DividendService)
    // ตัวอย่าง: return this.dividendService.getReceivedDividendsByUser(userId);
    return {
      message: 'Endpoint for received dividends implemented.',
      userId,
    };
  }
}
