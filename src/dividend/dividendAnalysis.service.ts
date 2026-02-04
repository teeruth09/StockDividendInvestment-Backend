import {
  Injectable,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  DividendCountdownRaw,
  DividendCountdownResponse,
} from './dividendAnalysis.type';
import { Prisma } from '@prisma/client';
import { QuantClientService } from 'src/integration/quantClient/quantClient.service';
import { addDays } from 'src/utils/time-normalize';
import { Prediction } from './dividend.model';

@Injectable()
export class DividendAnalysisService {
  private readonly logger = new Logger(DividendAnalysisService.name);
  constructor(
    private prisma: PrismaService,
    private readonly quantClient: QuantClientService,
  ) {}

  //Dividend Seasonality(predict XD)
  async updateSeasonality() {
    //[POST] คำนวณสถิติปันผล SET50 ทั้งหมดเก็บลง Cache (Min/Max/Avg/Countdown)
    return this.quantClient.post<string>('/main_app/update_seasonality_cache');
  }

  //get analyze tdts
  async getDividendCountdown(symbol: string) {
    const upperSymbol = symbol.toUpperCase();

    const endpoint = `/main_app/dividend_countdown/${upperSymbol}`;

    try {
      const dividendCountdownRaw = await this.quantClient.get<string>(endpoint);

      const dividendCountdownResult = (
        typeof dividendCountdownRaw === 'string'
          ? JSON.parse(dividendCountdownRaw)
          : dividendCountdownRaw
      ) as DividendCountdownResponse;

      // แยกเฉพาะส่วนที่เป็น Tag1, Tag2 ออกมา
      const activeTags: Record<string, any> = {};
      ['Tag1_Countdown', 'Tag2_Countdown'].forEach((tagName) => {
        if (dividendCountdownResult[tagName]) {
          activeTags[tagName] = dividendCountdownResult[tagName];
        }
      });

      return {
        status: dividendCountdownResult.status,
        symbol: dividendCountdownResult.symbol,
        data: activeTags,
      };
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error?.response?.status === 400 || error?.response?.status === 404) {
        this.updateSeasonality().catch(() => {});
        throw new ConflictException({
          message:
            'ระบบตรวจพบว่าข้อมูลยังไม่พร้อม กำลังเริ่มการคำนวณใหม่ กรุณารอประมาณ 1-2 นาที',
          status: 'PROCESSING',
        });
      }
      throw error;
    }
  }

  //Update Predict XD to Database
  async syncPredictionToDatabase(symbol: string) {
    const mlResponse = await this.getDividendCountdown(symbol);

    if (!mlResponse || mlResponse.status !== 'success') {
      throw new Error('Failed to get prediction data from ML');
    }
    if (!mlResponse.data) {
      this.logger.warn(`No data found for ${symbol}`);
      return;
    }

    const { symbol: stockSymbol } = mlResponse;
    const now = new Date();

    // วนลูปตามจำนวน Tag ที่ ML ส่งมา (Tag1, Tag2, ...)
    const tags = Object.entries(mlResponse.data);

    const results: Prediction[] = [];

    for (const [key, value] of tags) {
      if (
        key.startsWith('Tag') &&
        typeof value === 'object' &&
        value !== null
      ) {
        const info = value as DividendCountdownRaw;
        const xdDate = new Date(info.Next_XD_Date);
        const recordDate = addDays(xdDate, 1); // บวกเพิ่ม 1 วันจากวัน XD
        try {
          const upsertedPrediction = await this.prisma.prediction.upsert({
            where: {
              stock_symbol_predicted_ex_dividend_date: {
                stock_symbol: stockSymbol,
                predicted_ex_dividend_date: xdDate,
              },
            },
            update: {
              prediction_date: now,
              predicted_record_date: recordDate,
              predicted_payment_date: info.Est_Pay_Date
                ? new Date(info.Est_Pay_Date)
                : null,
              predicted_dividend_per_share: info.Est_Dividend_Baht,
              prediction_horizon_days: info.Days_Remaining,
            },
            create: {
              stock_symbol: stockSymbol,
              prediction_date: now,
              predicted_ex_dividend_date: xdDate,
              predicted_record_date: recordDate,
              predicted_payment_date: info.Est_Pay_Date
                ? new Date(info.Est_Pay_Date)
                : null,
              predicted_dividend_per_share: info.Est_Dividend_Baht,
              prediction_horizon_days: info.Days_Remaining,
            },
          });
          results.push(upsertedPrediction);
        } catch (error) {
          this.logger.error(
            `Failed to upsert prediction for ${stockSymbol}:`,
            error,
          );
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new BadRequestException(`Database error: ${error.message}`);
          }
          throw error;
        }
      }
    }
    return {
      success: true,
      message: `Prediction for ${stockSymbol} updated successfully`,
      updated_count: results.length,
      data: results,
    };
  }
}
