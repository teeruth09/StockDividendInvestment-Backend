import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StockAnalysisService } from './stockAnalysis.service';

@Injectable()
export class StockAnalysisSyncService implements OnModuleInit {
  private readonly logger = new Logger(StockAnalysisSyncService.name);
  private isAnalyzing = false;

  constructor(
    @Inject(forwardRef(() => StockAnalysisService))
    private readonly stockAnalysisService: StockAnalysisService,
  ) {}

  // 1. Method สำหรับรันกระบวนการวิเคราะห์แยกต่างหาก
  async handleAnalysisUpdate() {
    if (this.isAnalyzing) {
      this.logger.warn('⚠️ Analysis update is already in progress...');
      return;
    }
    this.isAnalyzing = true;

    try {
      const health = await this.stockAnalysisService.getHealthCheck();
      const cache = health.cache_status;

      this.logger.log('ตรวจสอบสถานะ Cache ก่อนรันงาน...');

      // 1. เช็คพวก Indicator พื้นฐานก่อน (Technical, TEMA, TDTS)
      if (cache.technical_count === 0 || cache.tema_count === 0) {
        this.logger.warn('Indicator ขาดหาย! กำลังสั่ง Update Indicators...');
        await this.stockAnalysisService.updateIndicator({ start_year: 2022 });
      }

      // 2. เช็ค Scoring (ถ้า Indicator มีแล้วแต่ Scoring ยังไม่มี)
      if (cache.scoring_count === 0) {
        this.logger.warn('Scoring ขาดหาย! กำลังสั่ง Update Scoring...');
        await this.stockAnalysisService.updateScoring({
          start_year: 2022,
          end_year: 2026,
          window: 15,
          threshold: 20,
        });
      }

      // 3. เช็ค GGM
      if (cache.ggm_count === 0) {
        this.logger.warn('GGM ขาดหาย! กำลังสั่ง Update GGM...');
        await this.stockAnalysisService.updateGgm({
          tickers: ['string'],
          years: 3,
          r_expected: 0.1,
          growth_rate: 0.04,
        });
      }

      this.logger.log('✅ Selective Cache Update Finished.');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Analysis Update Failed: ${errorMessage}`);
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
