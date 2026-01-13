// โครงสร้างจาก API TDTS
export interface TdtsCleanData {
  Stock: string;
  Year: number;
  Ex_Date: string;
  DPS: number;
  P_cum: number;
  P_ex: number;
  'DY (%)': number;
  'PD (%)': number;
  'T-DTS': number;
}

// โครงสร้างจาก API TEMA
export interface TemaCleanData {
  Stock: string;
  Year: number;
  Ex_Date: string;
  DPS: number;
  Price_Close: number;
  Price_TEMA: number;
  'Ret_Bf_TEMA (%)': number;
  'Ret_Af_TEMA (%)': number;
}

// โครงสร้าง Wrapper ที่คุณได้รับจาก API (status/source/data) ส่ง clean data
export interface AnalysisResponse<T> {
  status: string;
  source: string;
  symbol: string;
  data: {
    clean_data: T[];
  };
}

export interface MLRecommendationRaw {
  Stock: string;
  'DY (%)': number;
  T_DTS: number;
  'Ret_Af_TEMA (%)': number;
  'Ret_Bf_TEMA (%)': number;
  Cluster: number;
  'Total_Score (%)': number;
  Cluster_Name: string;
}

export interface MLApiResponse {
  status: string;
  source: string;
  count: number;
  data: MLRecommendationRaw[];
}

export type MLRecommendationArray = MLRecommendationRaw[];

export interface StockRecommendation {
  symbol: string;
  stockSector: string;
  clusterName: string;
  clusterId: number;
  totalScore: number;
  dyPercent: number;

  latestPrice: number;
  dividendExDate: number;
  dividendDps: number;
  predictExDate: number;
  predictDps: number;
  //confidence: number,

  retBfTema: number;
  retAfTema: number;
}

export enum ClusterType {
  DIVIDEND_TRAP = 'DIVIDEND_TRAP',
  GOLDEN_GOOSE = 'GOLDEN_GOOSE',
  NEUTRAL = 'NEUTRAL',
  REBOUND_STAR = 'REBOUND_STAR',
  UNKNOWN = 'UNKNOWN',
}

//map from type to text to ML
export enum ClusterTypeML {
  DIVIDEND_TRAP = 'Dividend Trap (Avoid)',
  GOLDEN_GOOSE = 'Golden Goose (Strong Trend)',
  NEUTRAL = 'Sell on Fact (Neutral)',
  REBOUND_STAR = 'Rebound Star (Buy on Dip)',
  UNKNOWN = 'UNKNOWN',
}
