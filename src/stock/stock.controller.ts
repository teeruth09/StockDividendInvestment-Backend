// src/stocks/stock.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateStockDto, Stock, UpdateStockDto } from './stock.model';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // 1. รายการหุ้นทั้งหมด
  @Get('stocks')
  async getAllStocks(@Query('sector') sector?: string): Promise<Stock[]> {
    const stocks = await this.stockService.getAllStocks(sector);
    return this.serializeBigInt(stocks);
  }

  // 2. รายละเอียดหุ้น
  @Get(':symbol/data')
  async getStockData(
    @Param('symbol') symbol: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('year') year?: string, // รองรับ year filter ด้วย
  ): Promise<Stock> {
    let startDate: Date | undefined = undefined;
    let endDate: Date | undefined = undefined;

    // ถ้ามี year ให้แปลงเป็น from/to ของปีนั้น
    if (year) {
      const y = parseInt(year, 10);
      if (isNaN(y)) throw new BadRequestException('year must be a number');
      startDate = new Date(`${y}-01-01`);
      endDate = new Date(`${y}-12-31`);
    } else {
      if (from) startDate = new Date(from);
      if (to) endDate = new Date(to);
    }

    return this.stockService.getStockData(symbol, startDate, endDate);
  }

  // 3.รายละเอียดหุ้นแยกแต่ละรายการ

  // =========================
  // 1. Historical Prices
  // =========================
  @Get(':symbol/prices')
  async getStockPrices(
    @Param('symbol') symbol: string,
    @Query('year') year?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { startDate, endDate } = this.parseDates(year, from, to);
    const data = await this.stockService.getHistoricalPrices(symbol, startDate, endDate);
    return this.serializeBigInt(data);
  }

  // =========================
  // 2. Dividends
  // =========================
  @Get(':symbol/dividends')
  async getStockDividends(
    @Param('symbol') symbol: string,
    @Query('year') year?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { startDate, endDate } = this.parseDates(year, from, to);
    return this.stockService.getDividends(symbol, startDate, endDate);
  }

  // =========================
  // 3. Predictions
  // =========================
  @Get(':symbol/predictions')
  async getStockPredictions(
    @Param('symbol') symbol: string,
    @Query('year') year?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { startDate, endDate } = this.parseDates(year, from, to);
    return this.stockService.getPredictions(symbol, startDate, endDate);
  }

  // =========================
  // Helper: parse year/from/to into Dates
  // =========================
  private parseDates(year?: string, from?: string, to?: string) {
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (year) {
      const y = parseInt(year, 10);
      if (isNaN(y)) throw new BadRequestException('year must be a number');
      startDate = new Date(`${y}-01-01`);
      endDate = new Date(`${y}-12-31`);
    } else {
      if (from) startDate = new Date(from);
      if (to) endDate = new Date(to);
    }

    return { startDate, endDate };
  }

  private serializeBigInt(obj: any) {
    return JSON.parse(
        JSON.stringify(obj, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value,
        )
    );
  }


  // 4. เพิ่มหุ้นใหม่
  @Post()
  async createStock(@Body() body: CreateStockDto) {
    return this.stockService.createStock(body);
  }

  // 5. อัปเดตหุ้น
  @Put(':symbol')
  async updateStock(
    @Param('symbol') symbol: string,
    @Body() body: UpdateStockDto,
  ) {
    return this.stockService.updateStock(symbol, body);
  }

  // 6. ลบหุ้น
  @Delete(':symbol')
  async deleteStock(@Param('symbol') symbol: string) {
    return this.stockService.deleteStock(symbol);
  }
}
