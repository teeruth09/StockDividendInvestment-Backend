import { Injectable } from '@nestjs/common';
import { QuantClientService } from 'src/integration/quantClient/quantClient.service';
import { StockService } from './stock.service';
import {
  MLApiResponse,
  MLRecommendationRaw,
  StockRecommendation,
} from './stockAnalysis.type';

@Injectable()
export class StockRecommendationService {
  constructor(
    private readonly quantClient: QuantClientService,
    private readonly stockService: StockService,
  ) {}

  async getRankedRecommendations(query: {
    page?: number;
    limit?: number;
    search?: string;
    sector?: string;
    cluster?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }) {
    // 1. ตั้งค่าพื้นฐานสำหรับ Pagination
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const endpoint = `/stock_recommendation/SET50`;
    const response = await this.quantClient.get<MLApiResponse>(endpoint);

    const rawResponse = response;
    let mlResult: MLApiResponse;
    if (typeof rawResponse === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      mlResult = JSON.parse(rawResponse);
    } else {
      mlResult = rawResponse;
    }

    let mlList: MLRecommendationRaw[] = [];

    if (Array.isArray(mlResult)) {
      mlList = mlResult;
    } else if (mlResult && mlResult.data && Array.isArray(mlResult.data)) {
      mlList = mlResult.data;
    }

    const enrichedData = await Promise.all(
      mlList.map(async (item) => {
        try {
          const dbData = await this.stockService.getStockData(item.Stock);

          const stockSector = dbData.sector;
          const latestPrice = dbData.historicalPrices?.[0]?.close_price || 0;
          const latestDividend = dbData.dividends?.[0];
          const latestPred = dbData.predictions?.[0];

          return {
            symbol: item.Stock,
            stockSector: stockSector,
            clusterName: item.Cluster_Name,
            clusterId: item.Cluster,
            totalScore: item['Total_Score (%)'],
            dyPercent: item['DY (%)'],

            latestPrice: latestPrice || 0,
            dividendExDate: latestDividend?.ex_dividend_date || null,
            dividendDps: latestDividend?.dividend_per_share || 0,
            predictExDate: latestPred?.predicted_ex_dividend_date || null,
            predictDps: latestPred?.predicted_dividend_per_share || 0,
            //confidence: latestPred?.confidence_score || 0,

            retBfTema: item['Ret_Bf_TEMA (%)'],
            retAfTema: item['Ret_Af_TEMA (%)'],
          };
        } catch (error) {
          console.log(error);
          return {
            symbol: item.Stock,
            totalScore: item['Total_Score (%)'],
            clusterName: item.Cluster_Name,
            latestPrice: 0,
          };
        }
      }),
    );

    let result = enrichedData;

    // 2. Search Logic (ค้นหาจากชื่อหุ้น)
    if (query.search) {
      const searchUpper = query.search.toUpperCase();
      result = result.filter((item) => item.symbol.includes(searchUpper));
    }

    // 3. Filtering Logic
    if (query.sector) {
      result = result.filter((item) => item.stockSector === query.sector);
    }
    if (query.cluster) {
      result = result.filter((item) => item.clusterName === query.cluster);
    }

    // 4. Sorting Logic
    const sortBy = (query.sortBy as keyof StockRecommendation) || 'totalScore';
    const order = query.order || 'desc';

    result.sort((a, b) => {
      const valA = a[sortBy] ?? 0;
      const valB = b[sortBy] ?? 0;
      return order === 'asc' ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1;
    });

    // 5. Pagination Logic (ตัดข้อมูลตามหน้า)
    const totalItems = result.length;
    const paginatedData = result.slice(skip, skip + limit);
    const totalPages = Math.ceil(totalItems / limit);

    // 6. Metadata สำหรับ Filter Options (ช่วยให้ Frontend สร้าง Dropdown ได้เอง)
    const sectors = [...new Set(enrichedData.map((i) => i.stockSector))].filter(
      Boolean,
    );
    const clusters = [
      ...new Set(enrichedData.map((i) => i.clusterName)),
    ].filter(Boolean);

    return {
      status: 'success',
      data: paginatedData,
      meta: {
        totalItems,
        itemCount: paginatedData.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
      options: {
        sectors,
        clusters,
      },
    };
  }
}
