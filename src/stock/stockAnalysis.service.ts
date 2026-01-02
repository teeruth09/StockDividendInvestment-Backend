import { Injectable } from '@nestjs/common';
import { QuantClientService } from 'src/integration/quantClient/quantClient.service';

interface ScoringCriteria {
  start_year: number;
  end_year: number;
  window: number;
  threshold: number;
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
}
