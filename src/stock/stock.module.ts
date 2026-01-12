import { forwardRef, Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { PrismaService } from 'src/prisma.service';
import { StockSyncService } from './stock.sync.service';
import { QuantClientModule } from 'src/integration/quantClient/quantClient.module';
import { StockAnalysisService } from './stockAnalysis.service';
import { DividendModule } from 'src/dividend/dividend.module';
import { StockAnalysisSyncService } from './stockAnalysis.sync.service';
import { StockRecommendationService } from './stockRecommendation.service';

@Module({
  imports: [QuantClientModule, forwardRef(() => DividendModule)], //Connect FastApi
  providers: [
    StockService,
    PrismaService,
    StockSyncService,
    StockAnalysisService,
    StockAnalysisSyncService,
    StockRecommendationService,
  ],
  controllers: [StockController],
  exports: [StockService],
})
export class StockModule {}
