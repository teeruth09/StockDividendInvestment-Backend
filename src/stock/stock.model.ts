import { IsNumber, IsOptional, IsString, IsBoolean } from 'class-validator';

export class Stock {
  stock_symbol: string;
  name: string;
  sector: string;
  corporate_tax_rate: number;
  boi_support: boolean;
  created_at: Date;
  updated_at: Date;
}

// DTO สำหรับสร้าง/อัปเดตหุ้น
export class CreateStockDto {
  @IsString()
  stock_symbol: string;

  @IsString()
  name: string;

  @IsString()
  sector: string;

  @IsNumber()
  corporate_tax_rate: number;

  @IsBoolean()
  boi_support: boolean;
}
export class UpdateStockDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sector?: string;

  @IsOptional()
  @IsNumber()
  corporate_tax_rate?: number;

  @IsOptional()
  @IsBoolean()
  boi_support?: boolean;
}

//map yahoo finance
export const YF_SYMBOL_MAP: Record<string, string> = {
  ADVANC: 'ADVANC.BK',
  PTT: 'PTT.BK',
  AOT: 'AOT.BK',
};

