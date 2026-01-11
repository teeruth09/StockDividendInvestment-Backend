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
