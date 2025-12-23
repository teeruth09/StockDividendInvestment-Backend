import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserId } from 'src/auth/decorators/user-id.decorator';
import { TaxService } from './tax.service';
import { CalculateTaxDto } from './tax.model';

@Controller('tax')
@UseGuards(JwtAuthGuard)
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  // 1: ดึงข้อมูลที่เคยบันทึกไว้ (แสดงในฟอร์ม)
  @Get('/info')
  async getTaxInfo(@UserId() userId: string, @Query('year') year: string) {
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    return this.taxService.getUserTaxInfo(userId, targetYear);
  }

  // 2. คำนวณภาษี ผลลัพธ์จากข้อมูลในฟอร์ม
  @Post('/calculate')
  async calculateTax(@UserId() userId: string, @Body() dto: CalculateTaxDto) {
    return this.taxService.calculateTaxSummary(userId, dto);
  }
}
