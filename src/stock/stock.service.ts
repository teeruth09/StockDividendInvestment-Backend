// src/stocks/stock.service.ts
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  CreateStockDto,
  HistoricalPrice,
  Stock,
  StockListResponse,
  UpdateStockDto,
  YF_SYMBOL_MAP,
} from './stock.model';
import yahooFinance from 'yahoo-finance2';
import * as NodeCache from 'node-cache';
import { Dividend } from 'src/dividend/dividend.model';
import {
  findMissingRanges,
  normalizeDate,
  splitRange,
} from 'src/utils/time-normalize';
import { DividendService } from 'src/dividend/dividend.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class StockService {
  private readonly cache = new NodeCache({ stdTTL: 3600 }); // cache 1 ชั่วโมง
  private readonly logger = new Logger(StockService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DividendService))
    private readonly dividendService: DividendService,
  ) {}

  private serializeBigInt<T>(obj: T): T {
    return JSON.parse(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
    ) as T;
  }

  // ดึงหุ้นทั้งหมด (optionally filter by sector)
  async getAllStocks(query: {
    search?: string;
    sector?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
    month?: number; // เดือนที่จ่ายปันผล (1-12)
    startDate?: string; // ช่วงวันที่เริ่มต้น
    endDate?: string; // ช่วงวันที่สิ้นสุด
  }): Promise<StockListResponse[]> {
    const { search, sector, month, startDate, endDate, sortBy, order } = query;

    const whereClause: Prisma.StockWhereInput = {};

    const sortField = sortBy || 'stock_symbol';
    const sortOrder = order || 'asc';

    if (search) {
      whereClause.stock_symbol = { contains: search.toUpperCase() };
    }
    if (sector) {
      whereClause.sector = sector;
    }
    if (startDate || endDate) {
      whereClause.dividends = {
        some: {
          ex_dividend_date: {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate ? new Date(endDate) : undefined,
          },
        },
      };
    }

    const stocks = await this.prisma.stock.findMany({
      where: whereClause,
      // orderBy: {
      //   [sortField]: sortOrder,
      // },
      include: {
        historicalPrices: { take: 1, orderBy: { price_date: 'desc' } },
        dividends: { take: 1, orderBy: { announcement_date: 'desc' } },
        //predictions: { take: 1, orderBy: { prediction_date: 'desc' } },
      },
    });

    const enrichedData = stocks.map((stock) => {
      const price = stock.historicalPrices?.[0];
      const div = stock.dividends?.[0];
      return {
        stockSymbol: stock.stock_symbol,
        stockSector: stock.sector,
        latestOpenPrice: price?.open_price ?? 0,
        latestHighPrice: price?.high_price ?? 0,
        latestLowPrice: price?.low_price ?? 0,
        latestClosePrice: price?.close_price ?? 0,
        latestPriceChange: price?.price_change ?? 0,
        latestPercentChange: price?.percent_change ?? 0,
        dividendExDate: div?.ex_dividend_date || null,
        dividendDps: div?.dividend_per_share ?? 0,
      };
    });

    let result = enrichedData;
    if (month) {
      result = result.filter(
        (item) =>
          item.dividendExDate &&
          new Date(item.dividendExDate).getMonth() + 1 === Number(month),
      );
    }

    result.sort((a: StockListResponse, b: StockListResponse) => {
      // ใช้ keyof เพื่อให้มั่นใจว่าเราเข้าถึง Property ที่มีอยู่จริง
      const field = sortField as keyof StockListResponse;

      const valA = a[field] ?? 0;
      const valB = b[field] ?? 0;
      return sortOrder === 'asc'
        ? valA > valB
          ? 1
          : -1
        : valA < valB
          ? 1
          : -1;
    });

    return result;

    // let result = stocks;
    // if (month) {
    //   result = stocks.filter((stock) => {
    //     const latestDiv = stock.dividends[0];
    //     if (!latestDiv) return false;
    //     return (
    //       new Date(latestDiv.ex_dividend_date).getMonth() + 1 === Number(month)
    //     );
    //   });
    // }

    // return result.map((stock) => ({
    //   ...stock,
    //   historicalPrices: stock.historicalPrices?.map((p) => ({
    //     ...p,
    //     price_change: p.price_change ?? 0,
    //     percent_change: p.percent_change ?? 0,
    //     volume_shares: Number(p.volume_shares),
    //     volume_value: Number(p.volume_value),
    //   })),
    //   dividends: stock.dividends?.map((d) => ({
    //     ...d,
    //     source_of_dividend: d.source_of_dividend ?? '', // แปลง null → empty string
    //   })),
    //   predictions: stock.predictions?.map((p) => ({
    //     ...p,
    //     predicted_dividend_per_share: p.predicted_dividend_per_share ?? 0,
    //     confidence_score: p.confidence_score ?? 0,
    //     prediction_horizon_days: p.prediction_horizon_days ?? 0,
    //   })),
    // }));
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
      historicalPrices: stock.historicalPrices?.map(
        (p): HistoricalPrice => ({
          ...p,
          price_change: p.price_change ?? 0,
          percent_change: p.percent_change ?? 0,
          volume_shares: BigInt(p.volume_shares),
          volume_value: BigInt(p.volume_value),
        }),
      ),
      dividends: stock.dividends?.map((d) => ({
        ...d,
        source_of_dividend: d.source_of_dividend ?? '',
      })),
      predictions: stock.predictions?.map((p) => ({
        ...p,
        predicted_dividend_per_share: p.predicted_dividend_per_share ?? 0,
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
    // 1. รับ String "2025-08-05" มา แล้วสร้าง Date แบบ Pure UTC
    const parts = dateString.split('-');
    const targetDate = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException(
        'Invalid date format. Please use YYYY-MM-DD.',
      );
    }

    // 2.ต้องใช้ setUTCHours เพื่อไม่ให้โดน Timezone Local ดีดวัน
    const startDate = new Date(targetDate.getTime());
    startDate.setUTCHours(0, 0, 0, 0); // 2025-08-04 00:00:00.000Z

    const endDate = new Date(targetDate.getTime());
    endDate.setUTCHours(23, 59, 59, 999); // 2025-08-04 23:59:59.999Z

    // 3. เรียกใช้ฟังก์ชันดึงราคาย้อนหลังที่ครอบคลุมการดึงจาก Yahoo ด้วย
    const prices: HistoricalPrice[] = await this.getHistoricalPrices(
      symbol,
      startDate,
      endDate,
    );

    // 4. ค้นหาราคาปิด ณ วันที่ระบุ
    const targetISO = targetDate.toISOString().split('T')[0]; // "2025-08-04"
    const priceRecord = prices.find(
      (p) => new Date(p.price_date).toISOString().split('T')[0] === targetISO,
    );

    if (!priceRecord) {
      // ถ้าไม่พบราคา ณ วันที่นั้น (อาจเป็นวันหยุดตลาด)
      throw new NotFoundException(
        `Historical price not found for ${symbol} on ${dateString}.`,
      );
    }

    // 5. ส่งค่า Close Price กลับไป
    return Number(priceRecord.close_price);
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

    // 1️⃣ โหลดข้อมูลจาก DB
    const dbPrices = await this.prisma.historicalPrice.findMany({
      where: {
        stock_symbol: symbol,
        price_date: { gte: startDate, lte: endDate },
      },
      orderBy: { price_date: 'desc' },
    });

    const dbDates = new Set(
      dbPrices.map((p) => normalizeDate(p.price_date).getTime()),
    );

    const yfSymbol = YF_SYMBOL_MAP[symbol] || symbol;
    // 1.1 ดึงวันหยุดจาก DB มาเก็บไว้ใน Set
    const holidays = await this.prisma.marketHoliday.findMany();
    const holidayDates = new Set(holidays.map((h) => h.holiday_date.getTime()));

    // 2️⃣ หาเฉพาะช่วงที่ขาด
    const missingRanges = findMissingRanges(
      startDate,
      endDate,
      dbDates,
      holidayDates,
    );
    //console.log(missingRanges);

    if (missingRanges.length === 0) {
      this.logger.log(
        `Data for ${symbol} is complete in Database. Skipping Call Yahoo Finance`,
      );
      // จัดเรียงและ Serialize คืนค่าได้เลย (ไม่ต้องเข้า Loop Yahoo)
      const sortedDb = dbPrices.sort(
        (a, b) => b.price_date.getTime() - a.price_date.getTime(),
      );
      return this.serializeBigInt<HistoricalPrice[]>(sortedDb);
    }

    const yfDataMapped: HistoricalPrice[] = [];

    // 3️⃣ lastClose เอาจาก DB (วันล่าสุด)
    let lastClose =
      dbPrices.length > 0 ? Number(dbPrices[0].close_price) : null;

    // 4️⃣ fetch ทีละช่วง (split เพื่อลด rate limit)
    for (const range of missingRanges) {
      const chunks = splitRange(range.from, range.to, 90);

      for (const chunk of chunks) {
        const fromTime = normalizeDate(chunk.from).getTime();
        const toTime = normalizeDate(chunk.to).getTime();

        // ถ้าเป็นวันเดียวกัน ให้ข้าม หรือขยายช่วง
        if (fromTime > toTime) {
          this.logger.debug(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `Skipping invalid range: ${chunk.from} to ${chunk.to}`,
          );
          continue;
        }
        try {
          // Yahoo chart() ไม่ยอมให้ period1 === period2
          // ต้องขยาย p2 ออกไป 1 วันเฉพาะตอนยิง API เท่านั้น
          const p1 = chunk.from;
          let p2 = chunk.to;
          if (fromTime === toTime) {
            p2 = new Date(fromTime + 24 * 60 * 60 * 1000);
          }
          const result = await yahooFinance.chart(
            yfSymbol,
            {
              interval: '1d',
              period1: p1,
              period2: p2,
            },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            {
              fetchOptions: {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                    'Chrome/120.0.0.0 Safari/537.36',
                  'Accept-Language': 'en-US,en;q=0.9',
                },
              },
            } as any,
          );

          if (!result?.quotes?.length) continue;

          // เรียงวัน ASC เพื่อคำนวณ change ถูก
          result.quotes.sort(
            (a, b) =>
              normalizeDate(a.date).getTime() - normalizeDate(b.date).getTime(),
          );

          const mapped = result.quotes
            .map((item) => ({
              ...item,
              date: normalizeDate(item.date),
            }))
            //.filter((item) => !dbDates.has(item.date.getTime()))
            .filter((item) => {
              const day = item.date.getDay();
              const isWeekend = day === 0 || day === 6; // 0 = อาทิตย์, 6 = เสาร์
              const hasNoVolume = !item.volume || item.volume === 0;
              const isDuplicate = dbDates.has(item.date.getTime());

              // กรอง: ไม่ใช่เสาร์-อาทิตย์, มีการซื้อขายจริง, และยังไม่มีใน DB
              return !isWeekend && !hasNoVolume && !isDuplicate;
            })
            .map((item) => {
              const close = item.close ?? 0;
              const prev = lastClose ?? close;

              const priceChange = close - prev;
              const percentChange = prev !== 0 ? (priceChange / prev) * 100 : 0;

              lastClose = close;

              return {
                stock_symbol: symbol,
                price_date: item.date,
                open_price: item.open ?? 0,
                high_price: item.high ?? 0,
                low_price: item.low ?? 0,
                close_price: close,
                price_change: priceChange,
                percent_change: percentChange,
                volume_shares: BigInt(item.volume ?? 0),
                volume_value:
                  item.volume && close
                    ? BigInt(Math.round(item.volume * close))
                    : BigInt(0),
              };
            });
          console.log('datalength', mapped.length);
          console.log('print', mapped);

          yfDataMapped.push(...mapped);

          if (mapped.length > 0) {
            await this.prisma.historicalPrice.createMany({
              data: mapped,
              skipDuplicates: true,
            });
          } else if (mapped.length === 0) {
            // กรณีขอยิงแล้วไม่มีข้อมูล (หลัง filter)
            // เราจะไล่เก็บวันหยุดทุกวันตั้งแต่ from ถึง to

            const startTimestamp = normalizeDate(chunk.from).getTime();
            const endTimestamp = normalizeDate(chunk.to).getTime();
            const todayTimestamp = normalizeDate(new Date()).getTime();

            // ไล่ Loop จาก timestamp เริ่มต้น ถึง สิ้นสุด
            // เพิ่มทีละ 24 ชั่วโมง (86400000 ms)
            for (
              let currentTs = startTimestamp;
              currentTs <= endTimestamp;
              currentTs += 24 * 60 * 60 * 1000
            ) {
              const tempDate = new Date(currentTs);
              const day = tempDate.getDay();
              const isToday = currentTs === todayTimestamp;

              // กรอง: ไม่ใช่เสาร์-อาทิตย์ และ ไม่ใช่วันนี้
              if (day !== 0 && day !== 6 && !isToday) {
                await this.prisma.marketHoliday.upsert({
                  where: { holiday_date: tempDate },
                  update: {},
                  create: {
                    holiday_date: tempDate,
                    description: 'Auto-detected (Zero Volume/Stale Data)',
                  },
                });
                this.logger.log(
                  `Marked ${tempDate.toISOString().split('T')[0]} as Market Holiday`,
                );
              }
            }
          }
        } catch (err) {
          if (
            err instanceof Error &&
            err.message?.includes('Too Many Requests')
          ) {
            this.logger.warn(`Yahoo rate limited for ${symbol}, stop fetching`);
            break;
          }
          throw err;
        }
      }
    }

    // 5️⃣ merge DB + Yahoo (กันข้อมูลซ้ำ)
    const uniqueMap = new Map<number, HistoricalPrice>();

    dbPrices.forEach((p) => {
      uniqueMap.set(
        normalizeDate(p.price_date).getTime(),
        p as HistoricalPrice,
      );
    });

    yfDataMapped.forEach((p) => {
      uniqueMap.set(normalizeDate(p.price_date).getTime(), p);
    });

    const sorted = Array.from(uniqueMap.values()).sort(
      (a, b) => b.price_date.getTime() - a.price_date.getTime(),
    );

    return this.serializeBigInt<HistoricalPrice[]>(sorted);
  }

  /**
   * ดึงราคาปิดล่าสุดของหุ้นหลายตัว
   * @param symbols Array ของสัญลักษณ์หุ้น
   * @returns Object map: { [stock_symbol]: latest_close_price }
   */
  async getCurrentPrices(symbols: string[]): Promise<Record<string, number>> {
    // 1. ดึงข้อมูลหุ้นเฉพาะที่ต้องการ พร้อมราคาล่าสุด
    const stocksWithLatestPrice = await this.prisma.stock.findMany({
      where: {
        stock_symbol: {
          in: symbols.map((s) => s.toUpperCase()), // ค้นหาเฉพาะ Symbol ที่ส่งเข้ามา
        },
      },
      include: {
        // ดึงราคาล่าสุดเพียง 1 แถว
        historicalPrices: { take: 1, orderBy: { price_date: 'desc' } },
      },
    });

    const currentPricesMap: Record<string, number> = {};

    // 2. วนลูปเพื่อดึงราคาปิดล่าสุด
    for (const stock of stocksWithLatestPrice) {
      const latestPrice = stock.historicalPrices?.[0]?.close_price;

      // 3. จัดเก็บใน Map
      if (latestPrice !== undefined && latestPrice !== null) {
        currentPricesMap[stock.stock_symbol] = latestPrice;
      } else {
        // ถ้าไม่พบราคา อาจจะใส่ 0 หรือ Log Warning ขึ้นอยู่กับ business requirement
        currentPricesMap[stock.stock_symbol] = 0;
        console.warn(`Price not found for stock: ${stock.stock_symbol}`);
      }
    }

    return currentPricesMap;
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

    // 2. แก้ไขปัญหาข้อมูลซ้ำวัน (Deduplication)
    // ใช้ Map โดยเอา Date (00:00:00) เป็น Key เพื่อให้ 1 วันมีได้แค่ 1 ค่า
    const uniqueMap = new Map<number, (typeof allPrices)[0]>();

    allPrices.forEach((p) => {
      const dateKey = new Date(p.price_date).setUTCHours(0, 0, 0, 0);

      // ถ้าวันนั้นมีข้อมูลอยู่แล้ว จะไม่ทับ (เพราะเราเรียง desc มา ตัวแรกที่เจอคือตัวที่ "สด" กว่า หรือตรงกับมาตรฐานกว่า)
      if (!uniqueMap.has(dateKey)) {
        uniqueMap.set(dateKey, p);
      }
    });

    // แปลง Map กลับเป็น Array (ซึ่งตอนนี้จะไม่มีวันซ้ำแล้ว และยังเรียงจาก ใหม่ -> เก่า อยู่)
    const dedupedPrices = Array.from(uniqueMap.values());

    let filtered: typeof allPrices = [];
    const latestDate = new Date(dedupedPrices[0].price_date); // วันที่ล่าสุดใน DB
    const rangeStart = new Date(latestDate);

    // คำนวณช่วงเวลาถอยจากวันที่ล่าสุด
    // 3. กรองช่วงเวลาตาม Interval (ใช้ข้อมูลที่คลีนแล้ว)
    switch (interval) {
      case '1D':
        filtered = dedupedPrices.slice(0, 1);
        break;
      case '5D':
        // เอา 5 แถวล่าสุด (5 วันทำการ)
        filtered = dedupedPrices.slice(0, 5);
        break;
      case '1M':
        rangeStart.setMonth(latestDate.getMonth() - 1);
        filtered = dedupedPrices.filter((p) => p.price_date >= rangeStart);
        break;
      case '3M':
        rangeStart.setMonth(latestDate.getMonth() - 3);
        filtered = dedupedPrices.filter((p) => p.price_date >= rangeStart);
        break;
      case '6M':
        rangeStart.setMonth(latestDate.getMonth() - 6);
        filtered = dedupedPrices.filter((p) => p.price_date >= rangeStart);
        break;
      case '1Y':
        rangeStart.setFullYear(latestDate.getFullYear() - 1);
        filtered = dedupedPrices.filter((p) => p.price_date >= rangeStart);
        break;
      case '3Y':
        rangeStart.setFullYear(latestDate.getFullYear() - 3);
        filtered = dedupedPrices.filter((p) => p.price_date >= rangeStart);
        break;
      case '5Y':
        rangeStart.setFullYear(latestDate.getFullYear() - 5);
        filtered = dedupedPrices.filter((p) => p.price_date >= rangeStart);
        break;
      default:
        filtered = dedupedPrices.slice(0, 1);
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

  //ดึงราคาวันที่จะซื้อและเงินปันผลเครดิตภาษีที่คาดว่าจะได้รับ
  async getHistoricalBuyContext(symbol: string, date: string, shares: number) {
    // 1. ดึงราคา ณ วันนั้น
    const price = await this.getPriceByDate(symbol, date);

    // 2. ดึงข้อมูลปันผลที่จะได้รับหากซื้อวันนี้
    const benefit = await this.dividendService.getEstimatedBenefit(
      symbol,
      new Date(date),
      shares,
    );

    return {
      symbol,
      purchaseDate: date,
      pricePerShare: price,
      totalCost: price * shares,
      estimatedDividend: benefit,
    };
  }
}
