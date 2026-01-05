// stock.sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StockService } from './stock.service';
import { YF_SYMBOL_MAP } from './stock.model';

@Injectable()
export class StockSyncService {
  private readonly logger = new Logger(StockSyncService.name);

  constructor(private readonly stockService: StockService) {}

  private shouldStop = false;
  private isSyncing = false; // เพิ่มเพื่อป้องกันการรันซ้อน

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ฟังก์ชันสำหรับสั่งหยุด
  stopSync() {
    if (this.isSyncing) {
      this.shouldStop = true;
      this.logger.warn('⚠️ Request to stop sync received...');
      return { message: 'Stopping sync process...' };
    }
    return { message: 'No sync process is currently running.' };
  }

  // ตั้งเวลาดึงข้อมูล: ทุกวันจันทร์-ศุกร์ เวลา 19:30 (หลังตลาดปิด) ถ้าอยากเทสเวลาอื่นให้แก้เลข x x x
  @Cron('0 30 19 * * 1-5', {
    name: 'daily_stock_sync',
    timeZone: 'Asia/Bangkok',
  })
  async handleStockSync() {
    // ตรวจสอบว่ากำลังรันอยู่หรือไม่
    if (this.isSyncing) {
      this.logger.warn('❌ Sync is already in progress. Ignoring request.');
      return;
    }
    this.isSyncing = true;
    this.shouldStop = false; // Reset ทุกครั้งที่เริ่ม
    this.logger.log('🚀 Starting Automated Stock Price Sync...');

    // 1. ดึง Keys ทั้งหมดจาก YF_SYMBOL_MAP จะได้ ['ADVANC', 'AOT', 'PTT', ...]
    const symbols = Object.keys(YF_SYMBOL_MAP);

    // 2. กำหนดช่วงเวลา
    const today = new Date();
    const startDate = new Date();
    // แนะนำให้ถอยไปสัก 3-5 วัน เผื่อติดวันหยุดยาวหรือข้อมูล Yahoo ดีเลย์
    // เพราะ skipDuplicates: true ใน Service คุณจะช่วยป้องกันข้อมูลซ้ำอยู่แล้ว
    startDate.setDate(today.getDate() - 5);

    try {
      for (const symbol of symbols) {
        if (this.shouldStop) {
          this.logger.warn('🛑 Sync process was stopped by user.');
          break;
        }
        try {
          // เรียกใช้ Function ที่เขียนไว้ใน StockService
          // Function นี้มี Logic เช็ค DB และ Save Yahoo data ให้อยู่แล้ว
          await this.stockService.getHistoricalPrices(symbol, startDate, today);
          this.logger.log(`✅ Successfully synced: ${symbol}`);

          // เพิ่ม Delay หยุดรอ 1 วินาที (1000ms) ก่อนไปหุ้นตัวถัดไป
          //await new Promise((resolve) => setTimeout(resolve, 1000));
          await this.sleep(1500);
        } catch (error) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          this.logger.error(`❌ Failed to sync ${symbol}: ${error.message}`);

          // หากเกิด Error อาจจะพักนานขึ้นหน่อยก่อนเริ่มตัวใหม่ เพื่อความปลอดภัย
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    } finally {
      // สำคัญ: ต้อง Reset สถานะในบล็อก finally เสมอเพื่อให้ระบบเริ่มใหม่ได้
      this.isSyncing = false;
      this.shouldStop = false;
      this.logger.log('🏁 Automated Stock Price Sync Finished.');
    }
  }
}
