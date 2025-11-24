import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TaxCreditService } from '../taxCredit/taxCredit.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import {
  Dividend as DividendModel,
  DividendReceived as DividendReceivedModel,
} from './dividend.model';
import { Prisma } from '@prisma/client';

@Injectable()
export class DividendService {
  constructor(
    private prisma: PrismaService,
    private taxCreditService: TaxCreditService,
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
  //   async calculateAndCreateReceivedDividends(
  //     dividendId: string,
  //   ): Promise<DividendReceivedModel[]> {
  //     const dividendInfo = await this.prisma.dividend.findUnique({
  //       where: { dividend_id: dividendId },
  //     });

  //     if (!dividendInfo) {
  //       throw new NotFoundException(`Dividend ID ${dividendId} not found.`);
  //     }

  //     const { stock_symbol, record_date, dividend_per_share } = dividendInfo;

  //     // 1. ดึงผู้ใช้ทั้งหมดที่เคยทำรายการซื้อ/ขายหุ้นตัวนี้
  //     const uniqueUsers = await this.prisma.transaction.findMany({
  //       where: { stock_symbol },
  //       select: { user_id: true },
  //       distinct: ['user_id'],
  //     });

  //     const receivedDividends: DividendReceivedModel[] = [];

  //     // 2. วนลูปคำนวณสิทธิ์ให้ผู้ใช้แต่ละราย
  //     for (const { user_id } of uniqueUsers) {
  //       // 3. ตรวจสอบจำนวนหุ้นสุทธิที่ถือครอง ณ Record Date
  //       const sharesAtRecordDate =
  //         await this.portfolioService.getSharesHeldOnDate(
  //           user_id,
  //           stock_symbol,
  //           record_date,
  //         );

  //       // 4. ถ้ามียอดหุ้นที่ถือครองในวัน Record Date และปันผลต่อหุ้นมากกว่า 0
  //       if (sharesAtRecordDate > 0 && dividend_per_share > 0) {
  //         // 5. คำนวณยอดปันผล
  //         const grossDividend = sharesAtRecordDate * dividend_per_share;

  //         // 💡 สมมติอัตราภาษีหัก ณ ที่จ่าย 10% (ตามมาตรา 50(2))
  //         const withholdingTaxRate = 0.1;
  //         const withholdingTax = grossDividend * withholdingTaxRate;
  //         const netDividendReceived = grossDividend - withholdingTax;

  //         // 6. บันทึกรายการปันผลที่ได้รับจริง
  //         const record = (await this.prisma.dividendReceived.create({
  //           data: {
  //             user_id,
  //             dividend_id: dividendId,
  //             shares_held: sharesAtRecordDate,
  //             gross_dividend: grossDividend,
  //             withholding_tax: withholdingTax,
  //             net_dividend_received: netDividendReceived,
  //             payment_received_date: dividendInfo.payment_date,
  //             created_at: new Date(),
  //           },
  //         })) as DividendReceivedModel;

  //         receivedDividends.push(record);

  //         // 7. Trigger คำนวณเครดิตภาษี (Tax Credit)
  //         try {
  //           await this.taxCreditService.calculateTaxCredit(record.received_id);
  //         } catch (error) {
  //           console.error(
  //             `Failed to calculate tax credit for Received ID ${record.received_id}:`,
  //             error,
  //           );
  //           // 💡 สามารถเลือกว่าจะโยน Error หรือแค่ Log แล้วให้ Process ดำเนินต่อไป
  //         }
  //       }
  //     }

  //     return receivedDividends;
  //   }
  async calculateAndCreateReceivedDividends(
    dividendId: string,
  ): Promise<DividendReceivedModel[]> {
    // 💡 1. ห่อหุ้มด้วย Transaction เพื่อให้การตรวจสอบและอัปเดตสถานะเป็น Atomic
    return this.prisma.$transaction(async (tx) => {
      // 1.1 ตรวจสอบข้อมูล Dividend (ใช้ tx)
      const dividendInfo = await tx.dividend.findUnique({
        where: { dividend_id: dividendId },
      });

      if (!dividendInfo) {
        throw new NotFoundException(`Dividend ID ${dividendId} not found.`);
      }

      // 🚨 1.2 ตรวจสอบสถานะป้องกันการเรียกซ้ำซ้อน
      if (dividendInfo.calculation_status === 'COMPLETED') {
        throw new BadRequestException(
          `Calculation for Dividend ID ${dividendId} is already completed.`,
        );
      }

      // 🚨 1.3 อัปเดตสถานะเป็น PROCESSING (ใช้ tx)
      await tx.dividend.update({
        where: { dividend_id: dividendId },
        data: { calculation_status: 'PROCESSING' },
      });

      const { stock_symbol, record_date, dividend_per_share } = dividendInfo;

      // 2. ดึงผู้ใช้ทั้งหมดที่เคยทำรายการซื้อ/ขายหุ้นตัวนี้ (ใช้ tx)
      const uniqueUsers = await tx.transaction.findMany({
        where: { stock_symbol },
        select: { user_id: true },
        distinct: ['user_id'],
      });

      const receivedDividends: DividendReceivedModel[] = [];

      // 3. วนลูปคำนวณสิทธิ์ให้ผู้ใช้แต่ละราย
      for (const { user_id } of uniqueUsers) {
        // 3.1 ตรวจสอบจำนวนหุ้นสุทธิที่ถือครอง ณ Record Date
        const sharesAtRecordDate =
          await this.portfolioService.getSharesHeldOnDate(
            user_id,
            stock_symbol,
            record_date,
          );

        // 3.2 ถ้ามียอดหุ้นที่ถือครองในวัน Record Date และปันผลต่อหุ้นมากกว่า 0
        if (sharesAtRecordDate > 0 && dividend_per_share > 0) {
          // 4. คำนวณยอดปันผล
          const grossDividend = sharesAtRecordDate * dividend_per_share;
          const withholdingTaxRate = 0.1;
          const withholdingTax = grossDividend * withholdingTaxRate;
          const netDividendReceived = grossDividend - withholdingTax;

          // 5. บันทึกรายการปันผลที่ได้รับจริง (ใช้ tx)
          const record = (await tx.dividendReceived.create({
            data: {
              user_id,
              dividend_id: dividendId,
              shares_held: sharesAtRecordDate,
              gross_dividend: grossDividend,
              withholding_tax: withholdingTax,
              net_dividend_received: netDividendReceived,
              payment_received_date: dividendInfo.payment_date,
              created_at: new Date(),
            },
          })) as DividendReceivedModel;

          receivedDividends.push(record);

          // 6. Trigger คำนวณเครดิตภาษี (ใช้ Service ภายนอก)
          try {
            // แม้จะเรียก Service ภายนอก แต่ถ้าเกิด Error ก่อนถึงจุดนี้ Transaction จะ Rollback
            await this.taxCreditService.calculateTaxCredit(record.received_id);
          } catch (error) {
            console.error(
              `Failed to calculate tax credit for Received ID ${record.received_id}:`,
              error,
            );
            // 💡 ในกรณีนี้ เราอนุญาตให้ดำเนินการต่อไปแม้ Tax Credit จะล้มเหลว
          }
        }
      }

      // 🚨 7. ถ้าการวนลูปสำเร็จ อัปเดตสถานะเป็น COMPLETED (ใช้ tx)
      await tx.dividend.update({
        where: { dividend_id: dividendId },
        data: {
          calculation_status: 'COMPLETED',
          calculated_at: new Date(),
        },
      });

      return receivedDividends;
    }); // ปิด $transaction
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
}
