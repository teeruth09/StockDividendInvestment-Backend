// src/stocks/stock.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateStockDto, UpdateStockDto, YF_SYMBOL_MAP } from './stock.model';
import yahooFinance from 'yahoo-finance2';
import * as NodeCache from 'node-cache';

@Injectable()
export class StockService {
  private readonly cache = new NodeCache({ stdTTL: 3600 }); // cache 1 ชั่วโมง
  private readonly logger = new Logger(StockService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ดึงหุ้นทั้งหมด (optionally filter by sector)
  async getAllStocks(sector?: string) {
    return this.prisma.stock.findMany({
      where: sector ? { sector } : undefined,
      orderBy: { stock_symbol: 'asc' },
    });
  }

  // ดึงรายละเอียดหุ้น 1 ตัว
  async getStockData(symbol: string, startDate?: Date, endDate?: Date) {
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
    return stock;
  }

  // =========================
  // 1. Historical Prices
  // Fetch Historical Prices (DB first, fallback Yahoo Finance)
  // =========================
  async getHistoricalPrices(symbol: string, startDate?: Date, endDate?: Date) {
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
        console.log("print",yfDataMapped) //print ค่าที่ยังไม่เก็บลง db

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
  async getDividends(symbol: string, startDate?: Date, endDate?: Date) {
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
    return stock.dividends;
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
}
