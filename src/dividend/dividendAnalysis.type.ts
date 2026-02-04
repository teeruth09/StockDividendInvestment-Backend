export interface DividendCountdownResponse {
  status: string;
  symbol: string;
  [key: string]: string | DividendCountdownRaw;
}

export interface DividendCountdownRaw {
  Avg_Date: Date;
  Next_XD_Date: Date;
  Days_Remaining: number;
  Est_Dividend_Baht: number;
  Est_Pay_Date: number;
}
