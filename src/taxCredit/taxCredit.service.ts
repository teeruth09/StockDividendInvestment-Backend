/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TaxCredit } from './taxCredt.model';
import { Stock } from '../stock/stock.model';

@Injectable()
export class TaxCreditService {
  constructor(private prisma: PrismaService) {}

  /**
   * คำนวณและบันทึกข้อมูลเครดิตภาษี (Tax Credit) ตามสูตรมาตรา 47 ทวิ
   * @param receivedId ID ของรายการปันผลที่ได้รับ (DividendReceived)
   * @returns TaxCreditModel
   */
  async calculateTaxCredit(receivedId: string, tx?: any): Promise<TaxCredit> {
    const prisma = tx || this.prisma; // ถ้ามี tx ให้ใช้ tx ถ้าไม่มีใช้ prisma ปกติ
    // 1. ดึงข้อมูลปันผลที่ได้รับ พร้อมความสัมพันธ์ที่จำเป็น (Dividend และ Stock)
    const receivedRecord = await prisma.dividendReceived.findUnique({
      where: { received_id: receivedId },
      include: {
        dividend: {
          include: {
            stock: true, // เพื่อดึง corporate_tax_rate จาก Stock
          },
        },
        prediction: { include: { stock: true } },
      },
    });

    if (!receivedRecord) {
      throw new NotFoundException(
        `DividendReceived record ID ${receivedId} not found.`,
      );
    }

    const grossDividend = receivedRecord.gross_dividend;
    const stockInfo: Stock = (receivedRecord.dividend?.stock ||
      receivedRecord.prediction?.stock)!;

    // 2. ตรวจสอบอัตราภาษีเงินได้นิติบุคคล (Corporate Tax Rate)
    // 💡 สมมติว่าฟิลด์ชื่อ corporate_tax_rate อยู่ในตาราง Stock
    const corporateTaxRatePercent = stockInfo.corporate_tax_rate;

    if (
      corporateTaxRatePercent === undefined ||
      corporateTaxRatePercent === null
    ) {
      throw new BadRequestException(
        `Corporate tax rate is missing for stock ${stockInfo.stock_symbol}. Cannot calculate tax credit.`,
      );
    }

    //อัตราภาษีจากเป็นทศนิยม (เช่น 0.20)
    const T = corporateTaxRatePercent;

    if (T <= 0 || T >= 1) {
      throw new BadRequestException('Invalid corporate tax rate.');
    }

    // 3. คำนวณเครดิตภาษีตามสูตร มาตรา 47 ทวิ
    // Credit Amount = (Gross Dividend * T) / (1 - T)
    const taxCreditAmount = (grossDividend * T) / (1 - T);

    // 4. คำนวณเงินได้ที่ต้องนำไปรวมคำนวณภาษี (Taxable Income)
    // Taxable Income = Gross Dividend + Tax Credit Amount
    const taxableIncome = grossDividend + taxCreditAmount;

    // 5. บันทึกข้อมูลเข้าตาราง TaxCredit
    const taxYear = receivedRecord.payment_received_date
      ? receivedRecord.payment_received_date.getFullYear()
      : new Date().getFullYear();

    const taxCreditRecord = (await prisma.taxCredit.upsert({
      where: { received_id: receivedId },
      update: {
        tax_year: taxYear,
        corporate_tax_rate: T || 0,
        tax_credit_amount: taxCreditAmount,
        taxable_income: taxableIncome,
      },
      create: {
        received_id: receivedId,
        user_id: receivedRecord.user_id,
        tax_year: taxYear,
        corporate_tax_rate: T || 0,
        tax_credit_amount: taxCreditAmount,
        taxable_income: taxableIncome,
      },
    })) as TaxCredit;

    return taxCreditRecord;
  }
}
