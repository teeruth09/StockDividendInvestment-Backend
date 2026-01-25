import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StockAnalysisService } from './stockAnalysis.service';

@Injectable()
export class StockAnalysisSyncService implements OnModuleInit {
  private readonly logger = new Logger(StockAnalysisSyncService.name);
  private isAnalyzing = false;

  constructor(private readonly stockAnalysisService: StockAnalysisService) {}

  // 1. Method สำหรับรันกระบวนการวิเคราะห์แยกต่างหาก
  async handleAnalysisUpdate() {
    if (this.isAnalyzing) {
      this.logger.warn('⚠️ Analysis update is already in progress...');
      return;
    }

    this.isAnalyzing = true;
    this.logger.log(
      '📊 Starting Automated Analysis Update (TEMA & Scoring)...',
    );

    try {
      // ขั้นตอนที่ 1: อัปเดต Indicator (TEMA/MACD/RSI)
      this.logger.log('⏳ Updating Indicator Cache...');
      await this.stockAnalysisService.updateIndicator({ start_year: 2022 });
      // ขั้นตอนที่ 2: อัปเดต Scoring (TDTS/Clusters)
      this.logger.log('⏳ Updating Scoring Cache...');
      await this.stockAnalysisService.updateScoring({
        start_year: 2022,
        end_year: new Date().getFullYear(),
        window: 15,
        threshold: 20,
      });

      // ขั้นตอนที่ 3: อัปเดต GGM
      this.logger.log('⏳ Updating GGM Cache...');
      await this.stockAnalysisService.updateGgm({
        tickers: ['string'],
        years: 3,
        r_expected: 0.1,
        growth_rate: 0.04,
      });

      this.logger.log('✅ Analysis Cache Update Finished Successfully.');
    } catch (error) {
      this.logger.error(`❌ Analysis Update Failed: ${error.message}`);
    } finally {
      this.isAnalyzing = false;
    }
  }

  // 2. ตั้งเวลาแยกกัน (เช่น รันหลังจาก Sync ราคาเสร็จสัก 30 นาที)
  @Cron('0 0 20 * * 1-5', {
    // รันตอน 20:00 น.
    name: 'daily_analysis_sync',
    timeZone: 'Asia/Bangkok',
  })
  async cronAnalysisUpdate() {
    await this.handleAnalysisUpdate();
  }

  // 3. รันทันทีเมื่อเปิดเครื่อง (Localhost/Server Start)
  onModuleInit() {
    this.logger.log('✨ System startup: Triggering initial Analysis Update...');
    this.handleAnalysisUpdate().catch(() => {});
  }
}
