/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { UserTaxInfo } from '@prisma/client'; // Import type จาก prisma
import { CalculateTaxDto } from './tax.model';

@Injectable()
export class TaxService {
  constructor(private prisma: PrismaService) {}
  private readonly TAX_BRACKETS = [
    { min: 0, max: 150000, rate: 0 },
    { min: 150000, max: 300000, rate: 0.05 },
    { min: 300000, max: 500000, rate: 0.1 },
    { min: 500000, max: 750000, rate: 0.15 },
    { min: 750000, max: 1000000, rate: 0.2 },
    { min: 1000000, max: 2000000, rate: 0.25 },
    { min: 2000000, max: 5000000, rate: 0.3 },
    { min: 5000000, max: Infinity, rate: 0.35 },
  ];

  async getUserTaxInfo(userId: string, year: number): Promise<CalculateTaxDto> {
    // 1. กำหนดช่วงวันที่ของปีภาษีนั้น (1 ม.ค. - 31 ธ.ค.)
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);

    // const taxInfo = await this.prisma.userTaxInfo.findUnique({
    //   where: { user_id_tax_year: { user_id: userId, tax_year: year } },
    // });

    // 2. ดึงข้อมูลภาษีพื้นฐาน และ ข้อมูลปันผลรวมในปีนั้น พร้อมกัน
    const [taxInfo, dividendSummary] = await Promise.all([
      this.prisma.userTaxInfo.findUnique({
        where: { user_id_tax_year: { user_id: userId, tax_year: year } },
      }),
      this.prisma.dividendReceived.aggregate({
        where: {
          user_id: userId,
          payment_received_date: {
            gte: startOfYear,
            lte: endOfYear,
          },
        },
        _sum: {
          gross_dividend: true, // รวมยอดปันผลก่อนหักภาษีทั้งหมดในปี
        },
      }),
    ]);

    if (!taxInfo) {
      throw new NotFoundException(`ไม่พบข้อมูลภาษีสำหรับปี ${year}`);
    }

    // 3. รวมยอด Gross Dividend ที่คำนวณได้ (ถ้าไม่มีให้เป็น 0)
    const totalGrossDividend = dividendSummary._sum.gross_dividend || 0;

    return {
      year: taxInfo.tax_year,
      salary: taxInfo.salary,
      bonus: taxInfo.bonus,
      otherIncome: taxInfo.other_income,
      // ส่งยอดปันผลรวมกลับไปที่ DTO ด้วย
      dividendAmount: totalGrossDividend,
      // 1. ส่วนตัวและครอบครัว
      personalDeduction: taxInfo.personal_deduction,
      spouseDeduction: taxInfo.spouse_deduction,
      childDeduction: taxInfo.child_deduction,
      parentDeduction: taxInfo.parent_deduction,
      // 2. ประกันและกองทุน
      socialSecurity: taxInfo.social_security,
      lifeInsurance: taxInfo.life_insurance,
      healthInsurance: taxInfo.health_insurance,
      parentHealthInsurance: taxInfo.parent_health_insurance,
      pvd: taxInfo.pvd_deduction,
      ssf: taxInfo.ssf_investment,
      rmf: taxInfo.rmf_investment,
      thaiEsg: taxInfo.thaiesg_investment,
      // 3. กลุ่มอสังหาริมทรัพย์และอื่นๆ
      homeLoanInterest: taxInfo.home_loan_interest,
      donationGeneral: taxInfo.donation_general,
      donationEducation: taxInfo.donation_education,
    };
  }

  async calculateTaxSummary(userId: string | null, dto: CalculateTaxDto) {
    let totalGrossDividend = 0;
    let totalTaxCredit = 0;
    let withholdingTax10 = 0;

    if (dto.dividendAmount !== undefined && dto.dividendAmount !== null) {
      console.log('user pass dividendAmount');
      // กรณี Guest: คำนวณจากค่าที่กรอกมาใน DTO
      const netDividend = dto.dividendAmount || 0;
      const factor = dto.dividendCreditFactor || 0.2; // ระบบตอนนี้ default 0.20 (20/80)

      // คำนวณกลับเป็นค่าต่างๆ
      // 1. เครดิตภาษี = ปันผลรับสุทธิ * factor
      totalTaxCredit = (netDividend * factor) / (1 - factor);
      // 2. ยอดปันผลรวม (Gross) = ปันผลรับสุทธิ + เครดิตภาษี
      totalGrossDividend = netDividend + totalTaxCredit;
      // 3. ภาษีหัก ณ ที่จ่าย 10% (คิดจากยอดปันผลสุทธิก่อนรวมเครดิต)
      withholdingTax10 = netDividend * 0.1;
    }
    // กรณี Login และไม่ได้แก้ไขยอดปันผลเอง (ใช้ข้อมูลจาก DB)
    else if (userId) {
      console.log('use default from db');
      // กรณี Login: ดึงเครดิตภาษีปันผลจากระบบโดยตรง
      // 1. ดึงเครดิตภาษีปันผลจากระบบโดยตรง (เพื่อให้ตัวเลขปันผลแม่นยำตามจริงในระบบ)
      const credits = await this.prisma.taxCredit.findMany({
        where: { user_id: userId, tax_year: dto.year },
      });

      // 1. คำนวณยอดปันผล และภาษีที่จ่ายไปแล้ว 10%
      totalGrossDividend = credits.reduce(
        (sum, c) => sum + c.taxable_income, //taxable_income = เงินปันผลก่อนหักภาษี + เครดิตภาษี
        0,
      );
      totalTaxCredit = credits.reduce((sum, c) => sum + c.tax_credit_amount, 0);

      // คำนวณภาษีหัก ณ ที่จ่าย 10% ของปันผล (ตามสูตรที่คุณระบุ)
      withholdingTax10 = credits.reduce(
        (sum, c) => sum + (c.taxable_income - c.tax_credit_amount) * 0.1,
        0,
      );
    }

    // 2. คำนวณรายได้และรายได้สุทธิ
    // กรณีใช้เครดิต: รายได้ = เงินเดือน + โบนัส + รายได้อื่น + (ปันผล + เครดิต)
    // กรณีไม่ใช้: รายได้ = เงินเดือน + โบนัส + รายได้อื่น (ปันผลโดน Final Tax 10% จบไปแล้ว)
    // *************************เงินได้พึงประเมิน ประเภท 1 และ 2 ************************
    const incomeType1And2 =
      (dto.salary || 0) + (dto.bonus || 0) + (dto.otherIncome || 0);

    // Step 1: หักค่าใช้จ่าย (Expenses)
    // รวมม.40(1)+(2) แล้วหัก 50% แต่ไม่เกิน 100,000 บาท
    const totalExpenses = Math.min(incomeType1And2 * 0.5, 100000);

    // Step 2: คำนวณรายได้หลังหักค่าใช้จ่าย (ก่อนหักลดหย่อน)
    const incomeAfterExpenses = incomeType1And2 - totalExpenses;

    const totalIncome = dto.includeDividendCredit
      ? incomeAfterExpenses + totalGrossDividend
      : incomeAfterExpenses;
    // รายละเอียดค่าลดหย่อน
    const { deductionDetails, totalDeductions } = this.normalizeDeductions(
      dto,
      totalIncome,
    );

    const netIncome = Math.max(0, totalIncome - totalDeductions);

    // 3. คำนวณแบบแยกขั้นบันได (แบบสะสมรวม)
    let remainingNetIncome = netIncome;
    let totalTaxBeforeCredit = 0;

    const breakdown = this.TAX_BRACKETS.map((bracket) => {
      const range = Math.min(
        Math.max(0, remainingNetIncome),
        bracket.max - bracket.min,
      );
      const taxInBracket = range * bracket.rate;

      if (range > 0) remainingNetIncome -= range;
      totalTaxBeforeCredit += taxInBracket;

      return {
        bracket: `${bracket.min.toLocaleString()} - ${bracket.max === Infinity ? 'ขึ้นไป' : bracket.max.toLocaleString()}`,
        rate: bracket.rate * 100,
        amount: range,
        tax: taxInBracket,
      };
    }).filter((b) => b.amount > 0 || b.bracket.startsWith('0')); // กรองเอาเฉพาะชั้นที่มีเงินได้ถึง

    // 4. สรุปยอดภาษีสุดท้าย (Final Calculation)
    // ภาษีที่จ่ายไว้เกิน = (ภาษีที่คำนวณได้) - (เครดิตภาษีปันผล) - (ภาษีหัก ณ ที่จ่าย 10%)
    let taxPayable = 0;
    let finalTaxCreditUsed = 0;
    let finalWithholdingUsed = 0;

    if (dto.includeDividendCredit) {
      // กรณีใช้เครดิต: นำทั้งเครดิตภาษีและ 10% ที่โดนหักไปมาลบออกจากภาษีที่คำนวณได้
      finalTaxCreditUsed = totalTaxCredit;
      finalWithholdingUsed = withholdingTax10;
      taxPayable =
        totalTaxBeforeCredit - finalTaxCreditUsed - finalWithholdingUsed;
    } else {
      // กรณีไม่ใช้เครดิต: ภาษีที่ต้องจ่ายคือตามขั้นบันไดของเงินเดือนเท่านั้น (ปันผลไม่เกี่ยวแล้ว)
      taxPayable = totalTaxBeforeCredit;
    }

    return {
      incomeType1And2,
      totalExpenses,
      incomeAfterExpenses,
      totalGrossDividend,
      totalIncome,
      totalDeductions,
      netIncome,
      taxBeforeCredit: totalTaxBeforeCredit, // ภาษีที่คำนวณได้จากเงินได้สุทธิ
      totalTaxCredit: finalTaxCreditUsed,
      withholdingTax10: finalWithholdingUsed,
      taxFinal: taxPayable > 0 ? taxPayable : 0,
      isRefund: taxPayable < 0,
      refundAmount: taxPayable < 0 ? Math.abs(taxPayable) : 0, // ภาษีที่ชำระไว้เกิน
      effectiveRateBefore:
        totalIncome > 0 ? (totalTaxBeforeCredit / totalIncome) * 100 : 0,
      effectiveRateAfter:
        totalIncome > 0 ? (Math.max(0, taxPayable) / totalIncome) * 100 : 0,
      deductionDetails,
      breakdown,
      includeDividendCredit: dto.includeDividendCredit, // คืนค่ากลับไปให้ UI ทราบสถานะ
    };
  }

  // ฟังก์ชันรวมค่าลดหย่อน (ตัวอย่างการจัดการเพดานลดหย่อน)
  private sumDeductions(info: UserTaxInfo): number {
    let total = 0;

    // 1. ค่าลดหย่อนส่วนตัว (พื้นฐาน 60,000 บาท)
    total += info.personal_deduction ?? 60000;

    // 2. ค่าลดหย่อนครอบครัว
    total += info.spouse_deduction ?? 0;
    total += info.child_deduction ?? 0;
    total += info.parent_deduction ?? 0;

    // 3. กลุ่มประกันและกองทุน (ต้องเช็คเพดาน)
    // ประกันสังคม สูงสุด 9,000 บาท
    total += Math.min(info.social_security ?? 0, 9000);

    // ประกันชีวิต + ประกันสุขภาพตัวเอง รวมกันไม่เกิน 100,000 บาท
    const lifeAndHealth =
      (info.life_insurance ?? 0) + (info.health_insurance ?? 0);
    total += Math.min(lifeAndHealth, 100000);

    // ดอกเบี้ยบ้าน สูงสุด 100,000 บาท
    total += Math.min(info.home_loan_interest ?? 0, 100000);

    return total;
  }

  // คำนวณฐานภาษี
  private calculateBracketTax(netIncome: number): number {
    let tax = 0;
    let remaining = netIncome;
    for (const bracket of this.TAX_BRACKETS) {
      if (remaining <= 0) break;
      const taxableInRange = Math.min(remaining, bracket.max - bracket.min);
      tax += taxableInRange * bracket.rate;
      remaining -= taxableInRange;
    }
    return tax;
  }

  private normalizeDeductions(dto: CalculateTaxDto, totalIncome: number) {
    /** ---------- 1. ส่วนตัว / ครอบครัว ---------- */
    const personal = dto.personalDeduction ?? 60000; //1. ลดหย่อนภาษีส่วนตัว ลดหย่อนได้ 60,000 บาททันที โดยไม่มีเงื่อนไขใด ๆ
    const spouse = dto.spouseDeduction ?? 0; //2. ลดหย่อนภาษีคู่สมรส ลดหย่อนได้ 60,000 บาท โดยต้องเป็นคู่สมรสที่จดทะเบียนถูกต้องตามกฎหมาย และคู่สมรสต้องไม่มีรายได้
    const child = dto.childDeduction ?? 0; //3. ลดหย่อนภาษีบุตร ลดหย่อนได้คนละ 30,000 บาท เฉพาะบุตรอายุไม่เกิน 20 ปี หรือไม่เกิน 25 ปีและกำลังเรียนอยู่ แต่ในกรณีลูกคนที่ 2 ขึ้นไป และเกิดตั้งแต่ปี 2561 เป็นต้นไป จะลดหย่อนได้คนละ 60,000 บาท
    const parent = dto.parentDeduction ?? 0; //4. ลดหย่อนภาษีบิดามารดา ลดหย่อนได้คนละ 30,000 บาท โดยบิดามารดาต้องมีอายุ 60 ปีขึ้นไป และมีรายได้ทั้งปีไม่เกิน 30,000 บาท โดยใช้สิทธิ์ซ้ำระหว่างพี่น้องไม่ได้

    /** ---------- 2. ประกัน ---------- */
    const socialSecurity = Math.min(dto.socialSecurity ?? 0, 9000); // ประกันสังคม ลดหย่อนได้ตามที่จ่ายจริง แต่ไม่เกิน 9,000 บาท

    const lifeInsurance = Math.min(dto.lifeInsurance ?? 0, 100000); //1. เบี้ยประกันชีวิตทั่วไป รวมถึงประกันแบบสะสมทรัพย์
    const healthInsurance = Math.min(dto.healthInsurance ?? 0, 25000); //2. เบี้ยประกันสุขภาพตัวเอง
    const parentHealthInsurance = Math.min(
      dto.parentHealthInsurance ?? 0,
      15000,
    ); //3. เบี้ยประกันสุขภาพบิดามารดา ลดหย่อนได้ตามที่จ่ายจริง แต่รวมกันไม่เกิน 15,000 บาท และสามารถรวมประกันสุขภาพพ่อแม่ของคู่สมรสมาลดหย่อนภาษีได้ ในกรณีที่คู่สมรสไม่มีรายได้

    /** ---------- 3. กองทุน (กลุ่มเดียวกัน cap รวม) ---------- */

    const pvd = dto.pvd ?? 0; //กองทุนสำรองเลี้ยงชีพ (PVD) ลดหย่อนได้ไม่เกิน 15% ของรายได้รวมทั้งปี แต่ไม่เกิน 500,000 บาท เมื่อรวมกับกองทุนเพื่อการเกษียณอื่น ๆ
    const rmf = dto.rmf ?? 0; //2. กองทุนรวมเพื่อการเลี้ยงชีพ (RMF) ลดหย่อนได้ไม่เกิน 30% ของรายได้รวมทั้งปี แต่ไม่เกิน 500,000 บาท เมื่อรวมกับกองทุนเพื่อการเกษียณอื่น ๆ
    const ssf = dto.ssf ?? 0; //4. กองทุนรวมเพื่อการออม (SSF) ลดหย่อนได้ไม่เกิน 30% ของรายได้รวมทั้งปี แต่ไม่เกิน 200,000 บาท และไม่เกิน 500,000 บาท เมื่อรวมกับกองทุนเพื่อการเกษียณอื่น ๆ
    const thaiEsg = dto.thaiEsg ?? 0; //6. กองทุนรวมไทยเพื่อความยั่งยืน (Thai ESG) ค่าซื้อหน่วยลงทุนในกองทุนรวมไทยเพื่อความยั่งยืน (Thai ESG) หักได้เท่าที่จ่ายจริง ไม่เกิน 30% ของเงินได้พึงประเมิน แต่ต้องไม่เกิน 300,000 บาท นับตั้งแต่วันซื้อหน่วยลงทุนเป็นวงเงินแยกต่างหาก โดยไม่ต้องนับรวมกับเงินลงทุนเพื่อการเกษียณอายุอื่น ๆ ซึ่งเกณฑ์การถือครองหน่วยลงทุน

    const fundTotalRaw = pvd + rmf + ssf + thaiEsg;

    const fundCapByIncome = totalIncome * 0.3;
    const fundCapAbsolute = 500000; //กองทุนทุกกองรวมกันห้ามเกิน 500,000 บาท

    const fundTotal = Math.min(fundTotalRaw, fundCapByIncome, fundCapAbsolute);

    /** ---------- 4. อสังหา ---------- */
    const homeLoanInterest = Math.min(dto.homeLoanInterest ?? 0, 100000); //สำหรับผู้ที่ซื้อบ้านหรือคอนโด สามารถนำดอกเบี้ยที่จ่ายให้กับธนาคารมาลดหย่อนภาษีได้ไม่เกิน 100,000 บาท

    /** ---------- 5. รวมลดหย่อนก่อนบริจาค ---------- */
    const deductionBeforeDonation =
      personal +
      spouse +
      child +
      parent +
      socialSecurity +
      lifeInsurance +
      healthInsurance +
      parentHealthInsurance +
      fundTotal +
      homeLoanInterest;

    /** ---------- 6. บริจาค ---------- */
    const donationBase = Math.max(0, totalIncome - deductionBeforeDonation);

    const donationGeneral = Math.min(
      dto.donationGeneral ?? 0,
      donationBase * 0.1,
    ); //1. เงินบริจาคทั่วไป ลดหย่อนได้ตามที่จ่ายจริง แต่ไม่เกิน 10% ของรายได้หลังหักค่าลดหย่อน

    const donationEducation = Math.min(
      (dto.donationEducation ?? 0) * 2,
      donationBase * 0.1,
    ); //2. เงินบริจาคเพื่อการศึกษา กีฬา พัฒนาสังคม และโรงพยาบาลรัฐ ลดหย่อนได้ 2 เท่าของเงินบริจาคจริง แต่ไม่เกิน 10% ของรายได้หลังหักค่าลดหย่อน

    /** ---------- Result ---------- */
    return {
      deductionDetails: {
        ค่าลดหย่อนส่วนตัว: personal,
        ค่าลดหย่อนคู่สมรส: spouse,
        ค่าลดหย่อนบุตร: child,
        ค่าลดหย่อนบิดามารดา: parent,
        ประกันสังคม: socialSecurity,
        เบี้ยประกันชีวิต: lifeInsurance,
        เบี้ยประกันสุขภาพ: healthInsurance,
        เบี้ยประกันสุขภาพบิดามารดา: parentHealthInsurance,
        'กองทุนรวมเพื่อเกษียณ(PVD + RMF + SSF + Thai Esg)': fundTotal,
        ดอกเบี้ยบ้าน: homeLoanInterest,
        เงินบริจาคทั่วไป: donationGeneral,
        เงินบริจาคเพื่อการศึกษา: donationEducation,
      },
      totalDeductions:
        deductionBeforeDonation + donationGeneral + donationEducation,
    };
  }
}
