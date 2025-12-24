import { Prisma } from '@prisma/client';
import { IsNumber, IsOptional } from 'class-validator';

export class User implements Prisma.UserCreateInput {
  user_id: string;
  username: string;
  email: string;
  password: string;
}

export class UserTaxInfoDto {
  @IsNumber()
  tax_year: number;

  // --- รายได้ (Income) ---
  @IsNumber()
  @IsOptional()
  salary: number;

  @IsNumber()
  @IsOptional()
  bonus: number;

  @IsNumber()
  @IsOptional()
  other_income: number;

  // --- 1. ค่าลดหย่อนส่วนตัวและครอบครัว ---
  @IsNumber()
  @IsOptional()
  personal_deduction: number; // พื้นฐาน 60,000

  @IsNumber()
  @IsOptional()
  spouse_deduction: number; // ลดหย่อนคู่สมรส (สูงสุด 60,000)

  @IsNumber()
  @IsOptional()
  child_deduction: number; // ลดหย่อนบุตร

  @IsNumber()
  @IsOptional()
  parent_deduction: number; // ลดหย่อนบิดามารดา (คนละ 30,000)

  @IsNumber()
  @IsOptional()
  disabled_deduction: number; // ลดหย่อนผู้พิการ (คนละ 60,000)

  // --- 2. กลุ่มประกันและการออม ---

  @IsNumber()
  @IsOptional()
  social_security: number; // ประกันสังคม (สูงสุด 9,000)

  @IsNumber()
  @IsOptional()
  life_insurance: number; // ประกันชีวิต (สูงสุด 100,000)

  @IsNumber()
  @IsOptional()
  health_insurance: number; // ประกันสุขภาพตัวเอง (สูงสุด 25,000)

  @IsNumber()
  @IsOptional()
  parent_health_insurance: number; // ประกันสุขภาพพ่อแม่ (สูงสุด 15,000)

  @IsNumber()
  @IsOptional()
  pvd_deduction: number; // กองทุนสำรองเลี้ยงชีพ

  @IsNumber()
  @IsOptional()
  ssf_investment: number; // กองทุน SSF

  @IsNumber()
  @IsOptional()
  rmf_investment: number; // กองทุน RMF

  @IsNumber()
  @IsOptional()
  thaiesg_investment: number; // กองทุน Thai ESG (ลดหย่อนใหม่)

  // --- 3. กลุ่มอสังหาริมทรัพย์และอื่นๆ ---

  @IsNumber()
  @IsOptional()
  home_loan_interest: number; // ดอกเบี้ยกู้ซื้อที่อยู่อาศัย (สูงสุด 100,000)

  @IsNumber()
  @IsOptional()
  donation_general: number; // เงินบริจาคทั่วไป

  @IsNumber()
  @IsOptional()
  donation_education: number; // เงินบริจาคเพื่อการศึกษา/กีฬา (ลดหย่อน 2 เท่า)
}
