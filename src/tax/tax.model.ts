export class CalculateTaxDto {
  year: number;

  // ===== รายได้ =====
  salary?: number;
  bonus?: number;
  otherIncome?: number;

  // ===== 1. ส่วนตัวและครอบครัว =====
  personalDeduction?: number; // ปกติ 60,000
  spouseDeduction?: number; // 60,000 (ไม่มีรายได้)
  childDeduction?: number; // รวมทั้งหมด
  parentDeduction?: number; // รวมทั้งหมด

  // ===== 2. ประกัน / กองทุน =====
  socialSecurity?: number; // cap 9,000
  lifeInsurance?: number; // รวมประกันชีวิต
  healthInsurance?: number; // สุขภาพตนเอง
  parentHealthInsurance?: number; // สุขภาพพ่อแม่ (cap 15,000)

  pvd?: number; // กองทุนสำรองเลี้ยงชีพ
  rmf?: number; // RMF
  ssf?: number; // SSF
  thaiEsg?: number; // Thai ESG

  // ===== 3. อสังหา / อื่น ๆ =====
  homeLoanInterest?: number; // cap 100,000
  donationGeneral?: number; // บริจาคทั่วไป
  donationEducation?: number; // บริจาคศึกษา (2 เท่า)

  includeDividendCredit?: boolean; //เพิ่มเพื่อเลือกว่าจะรวมปันผลหรือไม่
  dividendAmount?: number; // เงินปันผลรับสุทธิ (กรณี Guest)
  dividendCreditFactor?: number; // อัตราเครดิตภาษี เช่น 0.25 (20/80)
}
