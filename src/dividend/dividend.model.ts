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
