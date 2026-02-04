import {
  Injectable,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TaxCreditService } from '../taxCredit/taxCredit.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import {
  Dividend as DividendModel,
  DividendReceived as DividendReceivedModel,
} from './dividend.model';
import { Prisma } from '@prisma/client';
import yahooFinance from 'yahoo-finance2';

@Injectable()
export class DividendService {
  constructor(
    private prisma: PrismaService,
    private taxCreditService: TaxCreditService,
    @Inject(forwardRef(() => PortfolioService))
    private portfolioService: PortfolioService,
  ) {}

  // ********************************************************
  // 1. เมธอดหลัก: คำนวณและสร้างรายการปันผลที่ได้รับ (DividendReceived)
  // ********************************************************
  /**
   * คำนวณและบันทึกรายการปันผลที่ผู้ใช้แต่ละคนได้รับ โดยอ้างอิงยอดหุ้นสุทธิ ณ Record Date
   * @param dividendId ID ของการประกาศปันผล
   * @returns Array ของรายการปันผลที่ถูกบันทึก
   */
  async calculateAndCreateReceivedDividends(params: {
    userId: string;
    dividendId?: string;
    predictionId?: { symbol: string; date: string };
  }): Promise<DividendReceivedModel[]> {
    const { userId, dividendId, predictionId } = params;
    // 1. ห่อหุ้มด้วย Transaction เพื่อให้การตรวจสอบและอัปเดตสถานะเป็น Atomic
    return this.prisma.$transaction(async (tx) => {
      let stock_symbol: string;
      let record_date: Date;
      let dividend_per_share: number;
      let payment_date: Date | null;
      let predicted_ex_date: Date | null = null;
      let status: 'PREDICTED' | 'CONFIRMED' = 'CONFIRMED';
      // --- ส่วนที่ 1: ดึงข้อมูลแหล่งที่มา (Actual หรือ Prediction) ---
      if (dividendId) {
        const div = await tx.dividend.findUnique({
          where: { dividend_id: dividendId },
        });
        if (!div) throw new NotFoundException('Dividend not found');

        stock_symbol = div.stock_symbol;
        record_date = div.record_date;
        dividend_per_share = div.dividend_per_share;
        payment_date = div.payment_date;
        status = 'CONFIRMED';

        // อัปเดตสถานะ Dividend จริง
        await tx.dividend.update({
          where: { dividend_id: dividendId },
          data: { calculation_status: 'PROCESSING' },
        });
      } else if (predictionId) {
        const pred = await tx.prediction.findUnique({
          where: {
            stock_symbol_predicted_ex_dividend_date: {
              stock_symbol: predictionId.symbol,
              predicted_ex_dividend_date: new Date(predictionId.date),
            },
          },
        });
        if (!pred) throw new NotFoundException('Prediction not found');
        stock_symbol = pred.stock_symbol;
        predicted_ex_date = pred.predicted_ex_dividend_date;
        record_date = pred.predicted_record_date || pred.prediction_date;
        dividend_per_share = pred.predicted_dividend_per_share || 0;
        payment_date = pred.predicted_payment_date;
        status = 'PREDICTED';
      } else {
        throw new BadRequestException(
          'Either dividendId or predictionId must be provided.',
        );
      }

      const receivedDividends: DividendReceivedModel[] = [];

      const sharesAtRecordDate =
        await this.portfolioService.getSharesHeldOnDate(
          userId,
          stock_symbol,
          record_date,
        );

      console.log(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Debug: User ${userId} holds ${sharesAtRecordDate} shares on ${record_date}`,
      );
      console.log(`Debug: Dividend Per Share is ${dividend_per_share}`);

      // 3.2 ถ้ามียอดหุ้นที่ถือครองในวัน Record Date และปันผลต่อหุ้นมากกว่า 0
      if (sharesAtRecordDate > 0 && dividend_per_share > 0) {
        // 4. คำนวณยอดปันผล
        const grossDividend = sharesAtRecordDate * dividend_per_share;
        const withholdingTaxRate = 0.1;
        const withholdingTax = grossDividend * withholdingTaxRate;
        const netDividendReceived = grossDividend - withholdingTax;

        // 5. บันทึกรายการปันผลที่ได้รับจริง (ใช้ tx)
        const record = (await tx.dividendReceived.upsert({
          where: dividendId
            ? {
                user_dividend_unique: {
                  user_id: userId,
                  dividend_id: dividendId,
                },
              }
            : {
                user_prediction_unique: {
                  user_id: userId,
                  predicted_stock_symbol: predictionId!.symbol,
                  predicted_ex_date: new Date(predictionId!.date),
                },
              },
          update: {
            shares_held: sharesAtRecordDate,
            gross_dividend: grossDividend,
            withholding_tax: withholdingTax,
            net_dividend_received: netDividendReceived,
            payment_received_date: payment_date,
            status: status, // เผื่อกรณีมีการ Update จาก Predicted เป็น Confirmed
            predicted_ex_date: predicted_ex_date, //เผื่อมีการเปลี่ยนแปลง
          },
          create: {
            user_id: userId,
            status: status,
            dividend_id: dividendId || null,
            // ผูก Composite FK ไปยัง Prediction ถ้าเป็นโหมด Predict
            predicted_stock_symbol: predictionId ? predictionId.symbol : null,
            predicted_ex_date: predicted_ex_date, //บันทึกค่าเพื่อเอาไปโชว์หน้าบ้าน
            shares_held: sharesAtRecordDate,
            gross_dividend: grossDividend,
            withholding_tax: withholdingTax,
            net_dividend_received: netDividendReceived,
            payment_received_date: payment_date,
            created_at: new Date(),
          },
        })) as DividendReceivedModel;

        receivedDividends.push(record);

        // 6. Trigger คำนวณเครดิตภาษี (ใช้ Service ภายนอก)
        try {
          // แม้จะเรียก Service ภายนอก แต่ถ้าเกิด Error ก่อนถึงจุดนี้ Transaction จะ Rollback
          // พอ taxCreditService วิ่งไปใช้ this.prisma.dividendReceived.findUnique (ซึ่งเป็นคนละ Instance/Connection กับ tx) มันเลยมองไม่เห็นข้อมูลที่เพิ่งสร้าง
          await this.taxCreditService.calculateTaxCredit(
            record.received_id,
            tx,
          );
        } catch (error) {
          console.error(
            `Failed to calculate tax credit for Received ID ${record.received_id}:`,
            error,
          );
        }
      } else {
        //กรณีหุ้น เป็น 0 (ขายก่อน XD) หรือไม่มีปันผล
        // 1. หาข้อมูล DividendReceived ที่เข้าเงื่อนไขก่อน เพื่อเอา ID มาลบ TaxCredit
        const recordsToDelete = await tx.dividendReceived.findMany({
          where: dividendId
            ? { user_id: userId, dividend_id: dividendId }
            : {
                user_id: userId,
                predicted_stock_symbol: predictionId!.symbol,
                predicted_ex_date: new Date(predictionId!.date),
              },
          select: { received_id: true },
        });
        if (recordsToDelete.length > 0) {
          const ids = recordsToDelete.map((r) => r.received_id);

          // 2. ลบตัวลูก (TaxCredit) ก่อน
          await tx.taxCredit.deleteMany({
            where: {
              received_id: { in: ids },
            },
          });

          // 3. ลบตัวแม่ (DividendReceived) ตาม
          await tx.dividendReceived.deleteMany({
            where: {
              received_id: { in: ids },
            },
          });

          console.log(
            `Cleared dividend and tax credit for ${userId} (Shares became 0)`,
          );
        }
      }

      // 7. ถ้าการวนลูปสำเร็จ อัปเดตสถานะเป็น COMPLETED (ใช้ tx)
      if (dividendId) {
        await tx.dividend.update({
          where: { dividend_id: dividendId },
          data: {
            calculation_status: 'COMPLETED',
            calculated_at: new Date(),
          },
        });
      }

      return receivedDividends;
    });
  }

  // ********************************************************
  // 2. เมธอดสำหรับดึงข้อมูลการประกาศปันผล (Dividend)
  // ********************************************************

  /**
   * ดึงรายการประกาศปันผลทั้งหมดตามสัญลักษณ์หุ้น
   */
  async findAnnouncements(symbol?: string): Promise<DividendModel[]> {
    const where: Prisma.DividendWhereInput = symbol
      ? { stock_symbol: symbol }
      : {};

    const dividends = await this.prisma.dividend.findMany({
      where,
      orderBy: { record_date: 'desc' },
    });

    return dividends as DividendModel[];
  }

  // ********************************************************
  // 3. เมธอดสำหรับดึงประวัติปันผลที่ได้รับจริง (DividendReceived)
  // ********************************************************

  /**
   * ดึงประวัติการปันผลที่ผู้ใช้ได้รับจริง
   */
  async findReceivedHistory(userId: string): Promise<DividendReceivedModel[]> {
    const received = await this.prisma.dividendReceived.findMany({
      where: { user_id: userId },
      orderBy: { payment_received_date: 'desc' },
      include: {
        dividend: {
          select: {
            stock_symbol: true,
            ex_dividend_date: true,
            dividend_per_share: true,
          },
        },
        taxCredit: true,
      },
    });

    return received as DividendReceivedModel[];
  }

  //up comming xd
  async findUpcomingDividends(limit: number): Promise<DividendModel[]> {
    return this.prisma.dividend.findMany({
      where: { payment_date: { gt: new Date() } },
      orderBy: { payment_date: 'asc' },
      take: limit, // แสดง x รายการที่กำลังจะมาถึง
    });
  }

  // ปรับฟังก์ชันให้รับ referenceDate เพิ่ม (ถ้าไม่ส่งมาจะใช้ค่าปัจจุบัน) ลองกับวันที่ในอดีต
  async findUpcomingDividendsTest(
    limit: number,
    referenceDate: Date = new Date(),
  ): Promise<DividendModel[]> {
    return this.prisma.dividend.findMany({
      where: { payment_date: { gt: referenceDate } },
      orderBy: { payment_date: 'asc' },
      take: limit,
    });
  }

  /**
   *ดึงประวัติปันผลจาก Yahoo Finance และบันทึกลง DB
   */
  async syncDividendHistory(symbol: string): Promise<DividendModel[]> {
    const yfSymbol = `${symbol}.BK`;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 2);

    const newlyCreatedDividends: DividendModel[] = [];

    const normalizeDate = (date: Date) => {
      const d = new Date(date);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    };

    try {
      const result = await yahooFinance.historical(yfSymbol, {
        period1: startDate,
        period2: endDate,
        events: 'dividends',
      });

      if (result && result.length > 0) {
        for (const item of result) {
          // 1. ปรับวันที่จาก Yahoo ให้เป็น 00:00:00
          const exDate = normalizeDate(new Date(item.date));
          // เช็คว่าหุ้นตัวนี้มีปันผลในช่วง +/- 3 วันจากวันที่ Yahoo บอกมาไหม
          const marginDateStart = new Date(
            exDate.getTime() - 3 * 24 * 60 * 60 * 1000,
          );
          const marginDateEnd = new Date(
            exDate.getTime() + 3 * 24 * 60 * 60 * 1000,
          );
          // ตรวจสอบว่ามีข้อมูลเดิมอยู่แล้วหรือไม่
          const existing = await this.prisma.dividend.findFirst({
            where: {
              stock_symbol: symbol,
              ex_dividend_date: {
                gte: marginDateStart,
                lte: marginDateEnd,
              },
            },
          });

          if (!existing) {
            const paymentDate = new Date(exDate);
            paymentDate.setDate(paymentDate.getDate() + 15);

            const recordDate = new Date(exDate);
            recordDate.setDate(recordDate.getDate() + 1);

            const newDividend = await this.prisma.dividend.create({
              data: {
                stock_symbol: symbol,
                ex_dividend_date: exDate,
                announcement_date: exDate,
                record_date: recordDate,
                payment_date: paymentDate,
                dividend_per_share: item.dividends,
                source_of_dividend: 'กำไรสุทธิ',
                calculation_status: 'PENDING',
              },
            });

            newlyCreatedDividends.push(newDividend);
          }
        }
      }
      return newlyCreatedDividends; // ส่งคืนเฉพาะรายการที่สร้างใหม่
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Failed to sync dividends for ${symbol}:`, error.message);
      } else {
        console.error(`Failed to sync dividends for ${symbol}:`, String(error));
      }
      throw new BadRequestException(`Failed to sync dividends for ${symbol}`);
    }
  }
  // ********************************************************
  // 4. เมธอดสำหรับดึงปฏิทินประวัติปันผล (DividendCalendar)
  // ********************************************************
  async getDividendCalendar(month?: number, year?: number) {
    // 1. กำหนดช่วงเวลา (ถ้าไม่ระบุให้ดึงเดือนปัจจุบัน)
    const targetYear = year || new Date().getFullYear();
    const startDate = new Date(targetYear, month ? month - 1 : 0, 1);
    const endDate = new Date(targetYear, month ? month : 12, 0);

    // 2.1 ดึงข้อมูลจาก XD จริง
    const actualDividends = await this.prisma.dividend.findMany({
      where: {
        ex_dividend_date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        stock: true, //Join Stock Table
      },
      //orderBy: { ex_dividend_date: 'asc' },
    });
    // 2.2 ดึงข้อมูล XD Prediction
    const predictedDividends = await this.prisma.prediction.findMany({
      where: {
        predicted_ex_dividend_date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: { stock: true },
    });

    // 3. รวมและจัดกลุ่มข้อมูล
    const grouped = {};

    // จัดกลุ่มรายการจริง
    actualDividends.forEach((curr) => {
      const dateKey = curr.ex_dividend_date.toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = { date: dateKey, events: [] };
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      grouped[dateKey].events.push({
        dividend_id: curr.dividend_id,
        symbol: curr.stock_symbol,
        name: curr.stock?.name,
        type: 'XD', // ข้อมูลจริง
        ex_dividend_date: curr.ex_dividend_date,
        record_date: curr.record_date,
        payment_date: curr.payment_date,
        dividend_per_share: curr.dividend_per_share,
        source_of_dividend: curr.source_of_dividend,
      });
    });

    // จัดกลุ่มรายการคาดการณ์
    predictedDividends.forEach((curr) => {
      if (!curr.predicted_ex_dividend_date) return;
      const dateKey = curr.predicted_ex_dividend_date
        .toISOString()
        .split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = { date: dateKey, events: [] };
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      grouped[dateKey].events.push({
        dividend_id: `pred-${curr.stock_symbol}-${dateKey}`, // สร้าง ID ชั่วคราว
        symbol: curr.stock_symbol,
        name: curr.stock?.name,
        type: 'XD-PREDICT', // ข้อมูลคาดการณ์
        ex_dividend_date: curr.predicted_ex_dividend_date,
        record_date: curr.predicted_record_date,
        payment_date: curr.predicted_payment_date,
        dividend_per_share: curr.predicted_dividend_per_share,
      });
    });

    // แปลงจาก Object เป็น Array เพื่อให้ Frontend วนลูปง่าย
    return Object.values(grouped);
  }

  /**
   * ค้นหาปันผลที่ใกล้วันซื้อที่สุด และผู้ซื้อจะมีสิทธิ์ได้รับ (ซื้อก่อน XD)
   */
  async findNearFutureDividend(symbol: string, transactionDate: Date) {
    const tDate = new Date(transactionDate);
    tDate.setHours(0, 0, 0, 0);

    // หาปันผลที่ประกาศแล้ว (Actual) โดยวัน XD ต้อง > วันซื้อ
    const actualDividend = await this.prisma.dividend.findFirst({
      where: {
        stock_symbol: symbol,
        ex_dividend_date: { gt: tDate }, // ต้องซื้อก่อน XD
      },
      orderBy: { ex_dividend_date: 'asc' }, // เอาตัวที่ใกล้ที่สุด
    });

    if (actualDividend) {
      return {
        type: 'ACTUAL',
        data: actualDividend,
        dividendPerShare: actualDividend.dividend_per_share,
      };
    }
    // 2. ถ้าไม่มีประกาศจริง ให้หาจากตาราง Prediction
    // เราจะหาการทำนายล่าสุด (Latest Prediction) ที่มีวัน XD ในอนาคต
    const predictedDividend = await this.prisma.prediction.findFirst({
      where: {
        stock_symbol: symbol,
        predicted_ex_dividend_date: { gt: tDate },
      },
      orderBy: {
        predicted_ex_dividend_date: 'asc',
      },
    });
    if (predictedDividend) {
      return {
        type: 'PREDICTED',
        data: {
          dividend_id: `PRED-${predictedDividend.stock_symbol}-${predictedDividend.prediction_date.getTime()}`,
          stock_symbol: predictedDividend.stock_symbol,
          prediction_date: predictedDividend.prediction_date,
          ex_dividend_date: predictedDividend.predicted_ex_dividend_date,
          record_date: predictedDividend.predicted_record_date,
          payment_date: predictedDividend.predicted_payment_date,
          dividend_per_share: predictedDividend.predicted_dividend_per_share,
        },
        dividendPerShare: predictedDividend.predicted_dividend_per_share || 0,
      };
    }

    return null;
  }

  async getEstimatedBenefit(
    symbol: string,
    transactionDate: Date,
    shares: number,
  ) {
    // 1. ดึงข้อมูลหุ้นเพื่อเช็ค Tax Rate และ BOI Support
    const stock = await this.prisma.stock.findUnique({
      where: {
        stock_symbol: symbol,
      },
      select: {
        corporate_tax_rate: true,
        boi_support: true,
      },
    });
    if (!stock) {
      throw new NotFoundException(`Stock symbol ${symbol} not found.`);
    }

    // 2. หาปันผลงวดที่ใกล้ที่สุด (ตามที่เขียนไว้ก่อนหน้า)

    const nearDividend = await this.findNearFutureDividend(
      symbol,
      transactionDate,
    );

    if (!nearDividend) return null;

    const dps = nearDividend.dividendPerShare;
    const grossDividend = shares * dps;
    const withholdingTax = grossDividend * 0.1; // ภาษี ณ ที่จ่าย 10%
    const netDividend = grossDividend - withholdingTax;

    // 3. Logic คำนวณ Tax Credit
    let estimatedTaxCredit = 0;
    let taxCreditFactor = 0;

    // เงื่อนไข: จะได้เครดิตภาษีต่อเมื่อ boi_support = false และมี tax_rate > 0
    if (
      !stock.boi_support &&
      stock.corporate_tax_rate &&
      stock.corporate_tax_rate > 0
    ) {
      //console.log(`tax:${stock.corporate_tax_rate}`);
      // สูตร: เครดิตภาษี = เงินปันผล x [อัตราภาษี / (100 - อัตราภาษี)]
      taxCreditFactor =
        stock.corporate_tax_rate / (1 - stock.corporate_tax_rate);
      estimatedTaxCredit = grossDividend * taxCreditFactor;
    }

    return {
      dividendInfo: nearDividend.data,
      type: nearDividend.type,
      stockTaxInfo: {
        appliedTaxRate: stock.boi_support ? 0 : stock.corporate_tax_rate,
        isBoi: stock.boi_support,
        taxCreditFactor: taxCreditFactor,
      },
      calculation: {
        shares,
        grossDividend,
        withholdingTax,
        netDividend,
        estimatedTaxCredit,
        // มูลค่ารวมที่ผู้ถือหุ้นจะได้รับจริง (ถ้ายื่นภาษี)
        totalBenefitWithCredit: netDividend + estimatedTaxCredit,
      },
    };
  }
}
