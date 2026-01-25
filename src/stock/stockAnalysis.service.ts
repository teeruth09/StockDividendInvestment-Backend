import { Injectable } from '@nestjs/common';
import { QuantClientService } from 'src/integration/quantClient/quantClient.service';
import {
  AnalysisResponse,
  GgmApiResponse,
  TdtsCleanData,
  TemaCleanData,
} from './stockAnalysis.type';

interface ScoringCriteria {
  start_year: number;
  end_year: number;
  window: number;
  threshold: number;
}

interface AnalyzeTdts {
  symbol: string;
  start_year?: number;
  end_year?: number;
  threshold?: number;
}

interface AnalyzeTema {
  symbol: string;
  start_year?: number;
  end_year?: number;
  threshold?: number;
  window?: number;
}

interface CombineAnalyzeTdtsTema {
  symbol: string;
  start_year?: number;
  end_year?: number;
  threshold?: number;
  window?: number;
}

interface UpdateIndicatorCache {
  start_year: number;
}

interface UpdateGgmCache {
  tickers: string[];
  years: number;
  r_expected: number;
  growth_rate: number;
}

@Injectable()
export class StockAnalysisService {
  constructor(private readonly quantClient: QuantClientService) {}

  async getStockRecommendation(symbol: string) {
    const upperSymbol = symbol.toUpperCase();

    const endpoint = `/stock_recommendation/${upperSymbol}`;

    return this.quantClient.get<string>(endpoint);
  }

  async updateScoring(criteria: ScoringCriteria) {
    //[POST] Trigger Background Task to calculate Scores & Clusters for ALL SET50 stocks.
    const payload: ScoringCriteria = criteria ?? {
      start_year: 2022,
      end_year: 2026,
      window: 15,
      threshold: 20,
    };
    console.log('payload', payload);

    return this.quantClient.post<string>('/update_scoring_cache', payload);
  }

  //get analyze tdts
  async getAnalyzeTdtsScore(payload: AnalyzeTdts) {
    const {
      symbol,
      start_year = 2022,
      end_year = 2025,
      threshold = 10,
    } = payload;

    const upperSymbol = payload.symbol.toUpperCase();

    console.log('payload', payload);

    const endpoint = `/analyze_tdts/${upperSymbol}`;

    return this.quantClient.get<string>(endpoint, {
      params: {
        symbol,
        start_year,
        end_year,
        threshold,
      },
    });
  }

  //get analyze TEMA
  async getAnalyzeTemaScore(payload: AnalyzeTema) {
    const {
      symbol,
      start_year = 2022,
      end_year = 2025,
      threshold = 20,
      window = 15,
    } = payload;

    const upperSymbol = payload.symbol.toUpperCase();

    console.log('payload', payload);

    const endpoint = `/analyze_tema/${upperSymbol}`;

    return this.quantClient.get<string>(endpoint, {
      params: {
        symbol,
        start_year,
        end_year,
        threshold,
        window,
      },
    });
  }

  //Combine TDTS and TEMA
  async getCombinedAnalysis(params: CombineAnalyzeTdtsTema) {
    const { symbol, start_year, end_year, threshold, window } = params;

    // 1. ดึงข้อมูลดิบมาเป็น String ก่อน
    const [tdtsRaw, temaRaw] = await Promise.all([
      this.getAnalyzeTdtsScore({
        symbol,
        start_year,
        end_year,
        threshold,
      }),
      this.getAnalyzeTemaScore({
        symbol,
        start_year,
        end_year,
        threshold,
        window,
      }),
    ]);
    // 2. Parse JSON และระบุ Type
    const tdtsResult: AnalysisResponse<TdtsCleanData> =
      typeof tdtsRaw === 'string' ? JSON.parse(tdtsRaw) : tdtsRaw;
    const temaResult: AnalysisResponse<TemaCleanData> =
      typeof temaRaw === 'string' ? JSON.parse(temaRaw) : temaRaw;

    const tdtsList = tdtsResult.data?.clean_data || [];
    const temaList = temaResult.data?.clean_data || [];

    // 3. สร้าง Map และ Merge ตามปกติ (ระบุ Type เพื่อป้องกัน Error Price_TEMA)
    const temaMap = new Map<string, TemaCleanData>(
      temaList.map((item) => [item.Ex_Date, item]),
    );

    // 3. Merge ข้อมูล
    const mergedData = tdtsList.map((tdts) => {
      const tema = temaMap.get(tdts.Ex_Date);
      return {
        exDate: tdts.Ex_Date,
        symbol: tdts.Stock,
        year: tdts.Year,
        dps: tdts.DPS,
        pCum: tdts.P_cum,
        pEx: tdts.P_ex,
        dyPercent: tdts['DY (%)'],
        pdPercent: tdts['PD (%)'],
        tdtsScore: tdts['T-DTS'],
        temaPrice: tema ? tema.Price_TEMA : null,
        retBfTema: tema ? tema['Ret_Bf_TEMA (%)'] : 0,
        retAfTema: tema ? tema['Ret_Af_TEMA (%)'] : 0,
      };
    });

    return {
      status: 'success',
      symbol,
      data: mergedData,
    };
  }

  //[POST] Trigger Background Task to calculate MACD/RSI for ALL SET50 stocks.
  async updateIndicator(criteria: UpdateIndicatorCache) {
    const payload: UpdateIndicatorCache = criteria ?? {
      start_year: 2022,
    };
    console.log('startYear', payload);
    return this.quantClient.post<string>('/update_indicator_cache', payload);
  }

  //get technical history
  //[GET] Retrieve 1-Year Historical Technical Data (MACD/RSI) from Cache.
  async getTechnicalHistory(symbol: string) {
    const upperSymbol = symbol.toUpperCase();

    const endpoint = `/technical_history/${upperSymbol}`;

    return this.quantClient.get<string>(endpoint);
  }

  //Valuation (GGM) Dividend Discount Model Valuation
  //[POST] Trigger Background Task to calculate GGM Valuation for ALL SET50 stocks.
  async updateGgm(criteria: UpdateGgmCache) {
    const payload: UpdateGgmCache = criteria ?? {
      tickers: ['string'],
      years: 3,
      r_expected: 0.1,
      growth_rate: 0.04,
    };
    return this.quantClient.post<string>('/update_ggm_cache', payload);
  }
  //[GET] GGM Result from Cache
  async getValuationGgm(symbol: string) {
    const upperSymbol = symbol.toUpperCase();

    const endpoint = `/valuation_ggm/${upperSymbol}`;

    const ggmRaw = await this.quantClient.get<string>(endpoint);

    const ggmResult: GgmApiResponse =
      typeof ggmRaw === 'string' ? JSON.parse(ggmRaw) : ggmRaw;

    // ตรวจสอบว่าถ้า data เป็น Object ก้อนเดียว ให้หุ้มด้วย [ ] เพื่อให้เป็น Array
    const rawData = ggmResult.data;
    const ggmList = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];

    const mapData = ggmList.map((ggm) => {
      return {
        symbol: ggm.Symbol.split('.')[0],
        currentPrice: ggm.Current_Price,
        predictPrice: ggm.Pred_Price,
        diffPercent: ggm.Diff_Percent,
        meaning: ggm.Meaning,
        dividendsFlow: ggm.Dividends_Flow,
      };
    });

    return {
      status: ggmResult.status,
      source: ggmResult.source,
      count: ggmResult.count,
      data: mapData,
    };
  }
}
