import { IsNumber, IsOptional, IsString, IsBoolean } from 'class-validator';
import { Dividend, Prediction } from 'src/dividend/dividend.model';
export class Stock {
  stock_symbol: string;
  name: string;
  sector: string;
  corporate_tax_rate: number;
  boi_support: boolean;
  created_at: Date;
  updated_at: Date;

  historicalPrices?: HistoricalPrice[];
  dividends?: Dividend[];
  predictions?: Prediction[];
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

export class HistoricalPrice {
  stock_symbol: string;
  price_date: Date;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  price_change?: number | null;
  percent_change?: number | null;
  volume_shares: number;
  volume_value: number;
}
