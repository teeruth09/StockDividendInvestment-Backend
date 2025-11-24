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
  dividend_id: string;
  shares_held: number;
  gross_dividend: number;
  withholding_tax: number;
  net_dividend_received: number;
  payment_received_date?: Date | null;
  created_at: Date;

  // ความสัมพันธ์ (Optional fields)
  // user?: User;
  dividend?: Dividend;
  taxCredit?: TaxCredit | null;
}
export class Prediction {
  stock_symbol: string;
  prediction_date: Date;
  predicted_ex_dividend_date?: Date | null;
  predicted_payment_date?: Date | null;
  predicted_dividend_per_share?: number | null;
  predicted_dividend_yield?: number | null;
  predicted_price?: number | null;
  expected_return?: number | null;
  recommendation_type?: string | null;
  confidence_score?: number | null;
  model_version?: string | null;
  prediction_horizon_days?: number | null;
}
