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
  AOT: 'AOT.BK',
  AWC: 'AWC.BK',
  BANPU: 'BANPU.BK',
  BBL: 'BBL.BK',
  BCP: 'BCP.BK',
  BDMS: 'BDMS.BK',
  BEM: 'BEM.BK',
  BH: 'BH.BK',
  BJC: 'BJC.BK',
  BTS: 'BTS.BK',
  CBG: 'CBG.BK',
  CCET: 'CCET.BK',
  COM7: 'COM7.BK',
  CPALL: 'CPALL.BK',
  CPF: 'CPF.BK',
  CPN: 'CPN.BK',
  CRC: 'CRC.BK',
  DELTA: 'DELTA.BK',
  EGCO: 'EGCO.BK',
  GPSC: 'GPSC.BK',
  GULF: 'GULF.BK',
  HMPRO: 'HMPRO.BK',
  IVL: 'IVL.BK',
  KBANK: 'KBANK.BK',
  KKP: 'KKP.BK',
  KTB: 'KTB.BK',
  KTC: 'KTC.BK',
  LH: 'LH.BK',
  MINT: 'MINT.BK',
  MTC: 'MTC.BK',
  OR: 'OR.BK',
  OSP: 'OSP.BK',
  PTT: 'PTT.BK',
  PTTEP: 'PTTEP.BK',
  PTTGC: 'PTTGC.BK',
  RATCH: 'RATCH.BK',
  SCB: 'SCB.BK',
  SCC: 'SCC.BK',
  SCGP: 'SCGP.BK',
  TCAP: 'TCAP.BK',
  TIDLOR: 'TIDLOR.BK',
  TISCO: 'TISCO.BK',
  TLI: 'TLI.BK',
  TOP: 'TOP.BK',
  TRUE: 'TRUE.BK',
  TTB: 'TTB.BK',
  TU: 'TU.BK',
  VGI: 'VGI.BK',
  WHA: 'WHA.BK',
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
  volume_shares: bigint; // เปลี่ยนจาก number เป็น bigint
  volume_value: bigint; // เปลี่ยนจาก number เป็น bigint
}

export interface StockListResponse {
  stockSymbol: string;
  stockSector: string;
  latestOpenPrice: number;
  latestHighPrice: number;
  latestLowPrice: number;
  latestClosePrice: number;
  latestPriceChange: number;
  latestPercentChange: number;
  dividendExDate: Date | null;
  dividendDps: number;
}
