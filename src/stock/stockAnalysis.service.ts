import { Injectable } from '@nestjs/common';
import { QuantClientService } from 'src/integration/quantClient/quantClient.service';

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

interface UpdateIndicatorCache {
  start_year: number;
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
      end_year: 2024,
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
      end_year = 2024,
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
}
