import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { PrismaService } from 'src/prisma.service';
import { StockSyncService } from './stock.sync.service';
import { QuantClientModule } from 'src/integration/quantClient/quantClient.module';
import { StockAnalysisService } from './stockAnalysis.service';

@Module({
  imports: [QuantClientModule], //Connect FastApi
  providers: [
    StockService,
    PrismaService,
    StockSyncService,
    StockAnalysisService,
  ],
  controllers: [StockController],
  exports: [StockService],
})
export class StockModule {}
