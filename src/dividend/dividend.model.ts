import { TaxCredit } from '../taxCredit/taxCredt.model';
export class Dividend {
  dividend_id: string;
  stock_symbol: string;
  announcement_date: Date;
  ex_dividend_date: Date;
  record_date: Date;
  payment_date: Date;
  dividend_per_share: number;
  source_of_dividend?: string | null;
}
export class DividendReceived {
  received_id: string;
  user_id: string;

  //ระบุสถานะให้ชัดเจน
  status: 'PREDICTED' | 'CONFIRMED' | 'RECEIVED';
  //เป็น null เพราะถ้ายังไม่ประกาศจ่ายจริง จะไม่มี ID นี้
  dividend_id: string | null;

  shares_held: number;
  gross_dividend: number; //ปันผลเต็มก่อนหักภาษี
  withholding_tax: number; //หัก ณ ที่จ่ายปันผล
  net_dividend_received: number; //ปันผลสุทธิของหุ้น
  payment_received_date?: Date | null;
  created_at: Date;

  predicted_stock_symbol: string | null;
  predicted_ex_date: Date | null;

  // ความสัมพันธ์ (Optional fields)
  // user?: User;
  dividend?: Dividend;
  taxCredit?: TaxCredit | null;
}
export class Prediction {
  stock_symbol: string;
  prediction_date: Date;
  predicted_ex_dividend_date: Date | null;
  predicted_record_date?: Date | null;
  predicted_payment_date?: Date | null;
  predicted_dividend_per_share?: number | null;
  // predicted_dividend_yield?: number | null;
  // predicted_price?: number | null;
  // expected_return?: number | null;
  // recommendation_type?: string | null;
  confidence_score?: number | null;
  model_version?: string | null;
  prediction_horizon_days?: number | null;
}
