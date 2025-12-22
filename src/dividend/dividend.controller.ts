import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  Body,
  NotFoundException,
  UseGuards,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { DividendService } from './dividend.service';
import {
  Dividend as DividendModel,
  DividendReceived as DividendReceivedModel,
} from './dividend.model';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserId } from 'src/auth/decorators/user-id.decorator';

// 💡 อาจต้อง Import Model และ Service อื่นๆ ในอนาคต (เช่น UserService)

@Controller('dividends')
export class DividendController {
  constructor(private readonly dividendService: DividendService) {}

  // ********************************************************
  // 1. ดึงรายการประกาศปันผลทั้งหมด (Global/Filter by Symbol)
  // [GET] /dividends?symbol=ADVANC
  // ********************************************************
  @Get()
  async findAnnouncements(
    @Query('symbol') symbol?: string,
  ): Promise<DividendModel[]> {
    // 💡 ถ้าใช้ Guard ให้ดึงข้อมูลที่ทุกคนเข้าถึงได้ หรือใช้ Filter ที่เหมาะสม
    return this.dividendService.findAnnouncements(symbol);
  }

  // ********************************************************
  // 2. ดึงประวัติปันผลที่ผู้ใช้ได้รับ (History)
  // 💡 โดยปกติควรอยู่ใน UserController: [GET] /users/:username/dividends
  //    แต่หากต้องการแยก Controller เราสามารถทำได้โดยกำหนด Path ใหม่
  // ********************************************************
  // [GET] /dividends/received/:userId
  @Get('received')
  @UseGuards(JwtAuthGuard)
  async findReceivedHistory(
    @UserId() userId: string, //ดึง ID จาก JWT Token Payload
  ): Promise<DividendReceivedModel[]> {
    const history = await this.dividendService.findReceivedHistory(userId);

    if (!history || history.length === 0) {
      throw new NotFoundException(
        `Dividend history not found for user ${userId}`,
      );
    }

    return history;
  }

  // ********************************************************
  // 3. Endpoint สำหรับ Trigger การคำนวณปันผล (Admin/System Only)
  // 💡 เมธอดนี้ควรถูกเรียกใช้โดย Cron Job หรือ Admin Panel เท่านั้น และควรมี Guard ป้องกัน
  // [POST] /dividends/calculate
  // ********************************************************
  @Post('calculate/:dividendId')
  @HttpCode(HttpStatus.ACCEPTED) // คืนค่า 202 ACCEPTED
  // @UseGuards(AdminGuard)
  async triggerCalculation(
    @Param('dividendId') dividendId: string,
  ): Promise<{ message: string; count: number }> {
    console.log(`Triggering dividend calculation for ID: ${dividendId}`);
    try {
      const receivedRecords =
        await this.dividendService.calculateAndCreateReceivedDividends(
          dividendId,
        );

      return {
        message: `Dividend calculation completed. ${receivedRecords.length} records generated.`,
        count: receivedRecords.length,
      };
    } catch (error) {
      // ดักจับ Error ที่เกิดจากการเรียกซ้ำซ้อน
      if (
        error instanceof BadRequestException &&
        error.message.includes('already completed')
      ) {
        return {
          message: `Calculation for ID ${dividendId} was already completed. No action taken.`,
          count: 0,
        };
      }
      throw error; // โยน Error อื่น ๆ ต่อไป
    }
  }

  // 4. ดึงประวัติปันผลจาก YahooFinance และ save ลง DB (Admin/System Only)
  @Post('sync/:symbol')
  @UseGuards(JwtAuthGuard)
  async syncDividends(@Param('symbol') symbol: string) {
    const newDividends = await this.dividendService.syncDividendHistory(
      symbol.toUpperCase(),
    );
    return {
      message:
        newDividends.length > 0
          ? `Successfully synced ${newDividends.length} new dividend records.`
          : `No new dividends found for ${symbol}.`,
      data: newDividends,
    };
  }

  //5. ดึงปฏิทินปันผลทั้งหมด (Dividend Calendar)
  @Get('calendar')
  async getCalendar(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    // แปลง Query string เป็น number
    const m = month ? parseInt(month) : undefined;
    const y = year ? parseInt(year) : undefined;

    return this.dividendService.getDividendCalendar(m, y);
  }
}
