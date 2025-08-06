import { Prisma } from "@prisma/client";
import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class User implements Prisma.UserCreateInput {
  user_id: string;
  username: string;
  email: string;
  password: string;
}

export class UserTaxInfoDto {
  @IsNumber()
  tax_year: number;

  @IsNumber()
  @IsOptional()
  annual_income?: number;

  @IsNumber()
  @IsOptional()
  tax_bracket?: number;

  @IsNumber()
  @IsOptional()
  personal_deduction?: number;

  @IsNumber()
  @IsOptional()
  spouse_deduction?: number;

  @IsNumber()
  @IsOptional()
  child_deduction?: number;

  @IsNumber()
  @IsOptional()
  parent_deduction?: number;

  @IsNumber()
  @IsOptional()
  life_insurance_deduction?: number;

  @IsNumber()
  @IsOptional()
  health_insurance_deduction?: number;

  @IsNumber()
  @IsOptional()
  provident_fund_deduction?: number;

  @IsNumber()
  @IsOptional()
  retirement_mutual_fund?: number;
}