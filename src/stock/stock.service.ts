// src/stocks/stock.service.ts
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  CreateStockDto,
  HistoricalPrice,
  Stock,
  UpdateStockDto,
  YF_SYMBOL_MAP,
} from './stock.model';
import yahooFinance from 'yahoo-finance2';
import * as NodeCache from 'node-cache';
import { Dividend } from 'src/dividend/dividend.model';

@Injectable()
export class StockService {
  private readonly cache = new NodeCache({ stdTTL: 3600 }); // cache 1 ชั่วโมง
  private readonly logger = new Logger(StockService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ดึงหุ้นทั้งหมด (optionally filter by sector)
  async getAllStocks(sector?: string): Promise<Stock[]> {
    const stocks = await this.prisma.stock.findMany({
      where: sector ? { sector } : undefined,
      orderBy: { stock_symbol: 'asc' },
      include: {
        historicalPrices: { take: 1, orderBy: { price_date: 'desc' } },
        dividends: { take: 1, orderBy: { announcement_date: 'desc' } },
        predictions: { take: 1, orderBy: { prediction_date: 'desc' } },
      },
    });

    // แปลง BigInt → number
    return stocks.map((stock) => ({
      ...stock,
      historicalPrices: stock.historicalPrices?.map((p) => ({
        ...p,
        price_change: p.price_change ?? 0,
        percent_change: p.percent_change ?? 0,
        volume_shares: Number(p.volume_shares),
        volume_value: Number(p.volume_value),
      })),
      dividends: stock.dividends?.map((d) => ({
        ...d,
        source_of_dividend: d.source_of_dividend ?? '', // แปลง null → empty string
      })),
      predictions: stock.predictions?.map((p) => ({
        ...p,
        predicted_dividend_yield: p.predicted_dividend_yield ?? 0, // null → 0
        predicted_dividend_per_share: p.predicted_dividend_per_share ?? 0,
        predicted_price: p.predicted_price ?? 0,
        expected_return: p.expected_return ?? 0,
        confidence_score: p.confidence_score ?? 0,
        prediction_horizon_days: p.prediction_horizon_days ?? 0,
      })),
    }));
  }

  // ดึงรายละเอียดหุ้น 1 ตัว
  async getStockData(
    symbol: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Stock> {
    const stock = await this.prisma.stock.findUnique({
      where: { stock_symbol: symbol },
      include: {
        historicalPrices: {
          where:
            startDate || endDate
              ? {
                  price_date: {
                    gte: startDate,
                    lte: endDate,
                  },
                }
              : undefined,
          orderBy: { price_date: 'desc' },
        },
        dividends: {
          where:
            startDate || endDate
              ? {
                  announcement_date: {
                    gte: startDate,
                    lte: endDate,
                  },
                }
              : undefined,
          orderBy: { announcement_date: 'desc' },
        },
        predictions: {
          where:
            startDate || endDate
              ? {
                  prediction_date: {
                    gte: startDate,
                    lte: endDate,
                  },
                }
              : undefined,
          orderBy: { prediction_date: 'desc' },
        },
      },
    });

    if (!stock) throw new NotFoundException(`Stock ${symbol} not found`);
    // แปลง BigInt → number และ handle null
    return {
      ...stock,
      historicalPrices: stock.historicalPrices?.map((p) => ({
        ...p,
        price_change: p.price_change ?? 0,
        percent_change: p.percent_change ?? 0,
        volume_shares: Number(p.volume_shares),
        volume_value: Number(p.volume_value),
      })),
      dividends: stock.dividends?.map((d) => ({
        ...d,
        source_of_dividend: d.source_of_dividend ?? '',
      })),
      predictions: stock.predictions?.map((p) => ({
        ...p,
        predicted_dividend_yield: p.predicted_dividend_yield ?? 0,
        predicted_dividend_per_share: p.predicted_dividend_per_share ?? 0,
        predicted_price: p.predicted_price ?? 0,
        expected_return: p.expected_return ?? 0,
        confidence_score: p.confidence_score ?? 0,
        prediction_horizon_days: p.prediction_horizon_days ?? 0,
      })),
    };
  }

  // =========================
  // 1. Historical Prices

  // NEW: ดึงราคาปิดของหุ้น ณ วันที่กำหนด
  // [GET] /stock/:symbol/price-by-date?date=YYYY-MM-DD
  // ===================================
  async getPriceByDate(symbol: string, dateString: string): Promise<number> {
    // 1. แปลง Date String ให้เป็น Date Object
    const targetDate = new Date(dateString);
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException(
        'Invalid date format. Please use YYYY-MM-DD.',
      );
    }

    // 2. กำหนดช่วงเวลา (จากวันที่นั้นถึงวันที่นั้น)
    // เพื่อใช้ประโยชน์จาก HistoricalPrice Logic เดิม
    const startDate = new Date(targetDate.setHours(0, 0, 0, 0));
    const endDate = new Date(targetDate.setHours(23, 59, 59, 999));

    // 3. เรียกใช้ฟังก์ชันดึงราคาย้อนหลังที่ครอบคลุมการดึงจาก Yahoo ด้วย
    const prices: any[] = await this.getHistoricalPrices(
      // 💡 Note: ต้องเปลี่ยน type return ของ getHistoricalPrices เป็น array
      symbol,
      startDate,
      endDate,
    );

    // 4. ค้นหาราคาปิด ณ วันที่ระบุ
    const priceRecord = prices.find(
      (p) =>
        new Date(p.price_date).toDateString() === targetDate.toDateString(),
    );

    if (!priceRecord) {
      // ถ้าไม่พบราคา ณ วันที่นั้น (อาจเป็นวันหยุดตลาด)
      throw new NotFoundException(
        `Historical price not found for ${symbol} on ${dateString}.`,
      );
    }

    // 5. ส่งค่า Close Price กลับไป
    return priceRecord.close_price as number;
  }

  // Fetch Historical Prices (DB first, fallback Yahoo Finance)
  // =========================
  async getHistoricalPrices(
    symbol: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<HistoricalPrice[]> {
    if (!startDate || !endDate) {
      throw new NotFoundException('startDate and endDate are required');
    }

    // 1️⃣ Fetch DB data in range
    const dbPrices = await this.prisma.historicalPrice.findMany({
      where: {
        stock_symbol: symbol,
        price_date: { gte: startDate, lte: endDate },
      },
      orderBy: { price_date: 'desc' },
    });

    // 2️⃣ Determine if we need to fetch from Yahoo
    let yfDataMapped: any[] = [];
    const dbDates = new Set(dbPrices.map((p) => p.price_date.getTime()));

    try {
      const yfSymbol = YF_SYMBOL_MAP[symbol] || symbol;

      // Only fetch if DB missing some dates
      const needFetch =
        dbPrices.length === 0 ||
        dbPrices[0].price_date.getTime() > startDate.getTime() ||
        dbPrices[dbPrices.length - 1].price_date.getTime() < endDate.getTime();

      if (needFetch) {
        const yfQuery = {
          interval: '1d' as '1d',
          period1: startDate,
          period2: endDate,
        };

        const yfData = await yahooFinance.historical(yfSymbol, yfQuery);

        yfDataMapped = yfData
          .filter((item) => !dbDates.has(new Date(item.date).getTime())) // Filter duplicates
          .map((item, index, arr) => {
            const prevClose = index > 0 ? arr[index - 1].close : item.close;
            const priceChange = item.close - prevClose;
            const percentChange =
              prevClose !== 0 ? (priceChange / prevClose) * 100 : 0;

            return {
              stock_symbol: symbol,
              price_date: new Date(item.date),
              open_price: item.open,
              high_price: item.high,
              low_price: item.low,
              close_price: item.close,
              price_change: index === 0 ? 0 : priceChange,
              percent_change: index === 0 ? 0 : percentChange,
              volume_shares: BigInt(item.volume),
              volume_value:
                BigInt(item.volume) * BigInt(Math.round(item.close)),
            };
          });
        console.log('print', yfDataMapped); //print ค่าที่ยังไม่เก็บลง db

        // Save new Yahoo data to DB
        if (yfDataMapped.length > 0) {
          await this.prisma.historicalPrice.createMany({
            data: yfDataMapped,
            skipDuplicates: true,
          });
        }
      }
    } catch (err) {
      this.logger.error(
        `Yahoo Finance fetch failed for ${symbol}: ${err.message}`,
      );
    }

    // 3️⃣ Merge DB + Yahoo (filtered)
    const combined = [...dbPrices, ...yfDataMapped].sort(
      (a, b) => b.price_date.getTime() - a.price_date.getTime(),
    );

    // 4️⃣ Serialize BigInt for JSON
    return JSON.parse(
      JSON.stringify(combined, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    );
  }

  // =========================
  // 2. Dividends
  // =========================
  async getDividends(
    symbol: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Dividend[]> {
    const stock = await this.prisma.stock.findUnique({
      where: { stock_symbol: symbol },
      include: {
        dividends: {
          where:
            startDate || endDate
              ? { announcement_date: { gte: startDate, lte: endDate } }
              : undefined,
          orderBy: { announcement_date: 'desc' },
        },
      },
    });
    if (!stock) throw new NotFoundException(`Stock ${symbol} not found`);
    return stock.dividends.map((d) => ({
      ...d,
      source_of_dividend: d.source_of_dividend ?? '',
    }));
  }

  // =========================
  // 3. Predictions
  // =========================
  async getPredictions(symbol: string, startDate?: Date, endDate?: Date) {
    const stock = await this.prisma.stock.findUnique({
      where: { stock_symbol: symbol },
      include: {
        predictions: {
          where:
            startDate || endDate
              ? { prediction_date: { gte: startDate, lte: endDate } }
              : undefined,
          orderBy: { prediction_date: 'desc' },
        },
      },
    });
    if (!stock) throw new NotFoundException(`Stock ${symbol} not found`);
    return stock.predictions;
  }

  // เพิ่มหุ้นใหม่
  async createStock(data: CreateStockDto) {
    return this.prisma.stock.create({ data });
  }

  // อัปเดตหุ้น
  async updateStock(symbol: string, data: UpdateStockDto) {
    return this.prisma.stock.update({
      where: { stock_symbol: symbol },
      data,
    });
  }

  // ลบหุ้น
  async deleteStock(symbol: string) {
    return this.prisma.stock.delete({
      where: { stock_symbol: symbol },
    });
  }

  /**
   * Fetch Historical Prices for Chart
   * @param symbol - Stock symbol
   * @param interval - '1D', '5D', '1M', '3M', '6M', '1Y'
   */
  async getHistoricalPricesForChart(
    symbol: string,
    interval: '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' = '1D',
  ) {
    const upperSymbol = symbol.toUpperCase();
    // โหลดข้อมูลเรียงจากล่าสุดไปเก่าสุดก่อน
    const allPrices = await this.prisma.historicalPrice.findMany({
      where: { stock_symbol: upperSymbol },
      orderBy: { price_date: 'desc' },
    });

    if (!allPrices.length) return [];

    let filtered: typeof allPrices = [];
    const latestDate = new Date(allPrices[0].price_date); // วันที่ล่าสุดใน DB
    const rangeStart = new Date(latestDate);

    // คำนวณช่วงเวลาถอยจากวันที่ล่าสุด
    switch (interval) {
      case '1D':
        filtered = allPrices.slice(0, 1); // วันล่าสุด
        break;
      case '5D':
        // เอา 5 แถวล่าสุด (5 วันทำการ)
        filtered = allPrices.slice(0, 5);
        break;
      case '1M':
        rangeStart.setMonth(latestDate.getMonth() - 1);
        filtered = allPrices.filter((p) => p.price_date >= rangeStart);
        break;
      case '3M':
        rangeStart.setMonth(latestDate.getMonth() - 3);
        filtered = allPrices.filter((p) => p.price_date >= rangeStart);
        break;
      case '6M':
        rangeStart.setMonth(latestDate.getMonth() - 6);
        filtered = allPrices.filter((p) => p.price_date >= rangeStart);
        break;
      case '1Y':
        rangeStart.setFullYear(latestDate.getFullYear() - 1);
        filtered = allPrices.filter((p) => p.price_date >= rangeStart);
        break;
      case '3Y':
        rangeStart.setFullYear(latestDate.getFullYear() - 3);
        filtered = allPrices.filter((p) => p.price_date >= rangeStart);
        break;
      case '5Y':
        rangeStart.setFullYear(latestDate.getFullYear() - 5);
        filtered = allPrices.filter((p) => p.price_date >= rangeStart);
        break;
      default:
        filtered = allPrices.slice(0, 1);
    }
    // เรียงกลับเป็นเก่าสุด -> ใหม่สุด เพื่อใช้กับ chart
    filtered = filtered.reverse();

    // Serialize BigInt → string
    return filtered.map((p) => ({
      stock_symbol: p.stock_symbol,
      price_date: p.price_date,
      open_price: p.open_price,
      high_price: p.high_price,
      low_price: p.low_price,
      close_price: p.close_price,
      price_change: p.price_change,
      percent_change: p.percent_change,
      volume_shares: p.volume_shares.toString(),
      volume_value: p.volume_value.toString(),
    }));
  }

  /**
   * Fetch Percent Change Summary
   * @param symbol - Stock symbol
   */
  async getPriceChangeSummary(symbol: string) {
    const upperSymbol = symbol.toUpperCase();

    // Type ของ historicalPrice
    type HistoricalPrice = {
      stock_symbol: string;
      price_date: Date;
      open_price: number;
      high_price: number;
      low_price: number;
      close_price: number;
      price_change: number | null;
      percent_change: number | null;
      volume_shares: bigint;
      volume_value: bigint;
    };

    // โหลดข้อมูลทั้งหมด เรียงจากใหม่ -> เก่า
    const prices: HistoricalPrice[] =
      await this.prisma.historicalPrice.findMany({
        where: { stock_symbol: upperSymbol },
        orderBy: { price_date: 'desc' },
      });

    if (!prices.length) return null;

    const latestObj = prices[0];
    const latest = latestObj.close_price;
    const latestDate = new Date(latestObj.price_date);

    // helper: หาแถวแรกที่ price_date <= targetDate (prices เป็น desc)
    const findClosestBeforeOrEqual = (
      targetDate: Date,
    ): HistoricalPrice | null => {
      for (const p of prices) {
        if (new Date(p.price_date) <= targetDate) return p;
      }
      return prices.length ? prices[prices.length - 1] : null;
    };

    const result: Record<string, any> = {};

    // interval spec
    const specs = {
      '1D': { type: 'tradingDays', days: 1 },
      '5D': { type: 'tradingDays', days: 5 },
      '1M': { type: 'calendar', months: 1 },
      '3M': { type: 'calendar', months: 3 },
      '6M': { type: 'calendar', months: 6 },
      '1Y': { type: 'calendar', years: 1 },
      '3Y': { type: 'calendar', years: 3 },
      '5Y': { type: 'calendar', years: 5 },
    } as const;

    for (const [key, spec] of Object.entries(specs)) {
      let startObj: HistoricalPrice | null = null;

      if (spec.type === 'tradingDays') {
        const idx = Math.min(spec.days, prices.length) - 1;
        startObj = prices[idx] ?? null;
      } else {
        // calendar-based
        const target = new Date(latestDate);
        if ('months' in spec) target.setMonth(target.getMonth() - spec.months);
        if ('years' in spec)
          target.setFullYear(target.getFullYear() - spec.years);
        startObj = findClosestBeforeOrEqual(target);
      }

      if (!startObj) continue;
      const startClose = startObj.close_price;
      if (!startClose || startClose === 0) continue;

      const percent = ((latest - startClose) / startClose) * 100;

      result[key] = {
        from: startObj.price_date,
        to: latestObj.price_date,
        startClose,
        endClose: latest,
        percentChange: Number(percent.toFixed(2)),
      };
    }

    const stock = await this.prisma.stock.findUnique({
      where: { stock_symbol: symbol },
    });
    if (!stock) {
      throw new Error(`Stock ${symbol} not found`);
    }

    return {
      symbol: upperSymbol,
      name: stock.name,
      latestPrice: latest,
      summary: result,
    };
  }
}
