import { StockAnalysisService } from './stockAnalysis.service';
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
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateStockDto, Stock, UpdateStockDto } from './stock.model';
import { StockSyncService } from './stock.sync.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AdminGuard } from 'src/auth/admin.guard';

@Controller('stock')
export class StockController {
  constructor(
    private readonly stockService: StockService,
    private readonly stockSyncService: StockSyncService,
    private readonly analysisService: StockAnalysisService,
  ) {}

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

  @Get(':symbol/price-by-date')
  async getPriceByDate(
    @Param('symbol') symbol: string,
    @Query('date') dateString: string, // รับวันที่เป็น Query Parameter
  ): Promise<{ price: number }> {
    if (!dateString) {
      throw new BadRequestException('Date query parameter is required.');
    }
    const price = await this.stockService.getPriceByDate(symbol, dateString);
    return { price };
  }

  @Get(':symbol/prices')
  async getStockPrices(
    @Param('symbol') symbol: string,
    @Query('year') year?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { startDate, endDate } = this.parseDates(year, from, to);
    const data = await this.stockService.getHistoricalPrices(
      symbol,
      startDate,
      endDate,
    );
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
      ),
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

  @Get(':symbol/prices/chart')
  async getStockPricesChart(
    @Param('symbol') symbol: string,
    @Query('interval')
    interval: '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' = '1D',
  ) {
    const data = await this.stockService.getHistoricalPricesForChart(
      symbol,
      interval,
    );
    // console.log(`${symbol}/prices/chart`);
    // console.log(data);
    return data;
  }

  @Get(':symbol/summary')
  async getStockSummary(@Param('symbol') symbol: string) {
    const summary = await this.stockService.getPriceChangeSummary(symbol);
    // console.log(`${symbol}/summary`);
    // console.log(summary);
    return summary;
  }

  //get ข้อมูลเงินปันผลและเครดิตภาษีที่คาดจะได้รับจากการซื้อรอบที่ใกล้ที่สุด
  @Get(':symbol/purchase-metadata')
  async getPurchaseMetadata(
    @Param('symbol') symbol: string,
    @Query('date') dateString: string,
    @Query('shares') shares: string,
  ) {
    if (!dateString || !shares) {
      throw new BadRequestException(
        'Date and shares are required for analysis.',
      );
    }

    const numShares = parseInt(shares, 10);

    return await this.stockService.getHistoricalBuyContext(
      symbol,
      dateString,
      numShares,
    );
  }

  //Auto mation sync ราคาหุ้นรยวัน ทำงานตาม schedule
  @Post('sync-all')
  @UseGuards(JwtAuthGuard, AdminGuard) // รันตามลำดับ: เช็ค Token -> เช็ค Email
  async triggerSyncAll() {
    await this.stockSyncService.handleStockSync();
    return { message: 'Sync started successfully' };
  }

  /*
    Connect Backend nestjs to FastAPI
    API List 
    1.update scoring cache เป็นการ update score หุ้นแต่ละตัว
    2.recomendation แนะนำหุ้นตาม score ที่ได้
    3.analyze tdts get ค่า tdts ที่คำนวนได้ในหุ้นรายตัว
    4.update indicator cache เป็นการ update กราฟเทคนิค
    5.techincal history เป็นการ get ค่าผลตอบแทน 1 ปีย้อนหลัง
  */
  @Get('recommendation/:symbol')
  async getRecommendation(@Param('symbol') symbol: string) {
    const data = await this.analysisService.getStockRecommendation(symbol);
    // Return to Frontend
    return {
      success: true,
      data: data,
    };
  }

  @Post('update-scoring-cache')
  async postUpdateScoring(
    @Body()
    body: {
      start_year: number;
      end_year: number;
      window: number;
      threshold: number;
    },
  ) {
    return this.analysisService.updateScoring(body);
  }

  //Result มาจาก cache ดังนั้นรอบถัดไปไม่ต้องส่ง year ไปก็ได้
  @Get('analyze-tdts/:symbol')
  async getAnalyzeTdtsScoring(
    @Param('symbol') symbol: string,
    @Query('start_year') start_year?: number,
    @Query('end_year') end_year?: number,
    @Query('threshold') threshold?: number,
  ) {
    return this.analysisService.getAnalyzeTdtsScore({
      symbol,
      start_year,
      end_year,
      threshold,
    });
  }

  @Post('update-indicator-cache')
  async postUpdateIndicator(
    @Body()
    body: {
      start_year: number;
    },
  ) {
    return this.analysisService.updateIndicator(body);
  }

  //Result มาจาก cache
  @Get('technical-history/:symbol')
  async getTechnicalHistory(@Param('symbol') symbol: string) {
    return this.analysisService.getTechnicalHistory(symbol);
  }
}
