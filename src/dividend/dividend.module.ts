import { Module, forwardRef } from '@nestjs/common';
import { DividendService } from './dividend.service';
import { DividendController } from './dividend.controller';
import { TaxCreditModule } from '../taxCredit/taxCredit.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { PrismaService } from 'src/prisma.service';
import { TransactionModule } from 'src/transaction/transaction.module';
import { QuantClientModule } from 'src/integration/quantClient/quantClient.module';
import { DividendAnalysisService } from './dividendAnalysis.service';

@Module({
  imports: [
    QuantClientModule,
    TaxCreditModule,
    forwardRef(() => PortfolioModule),
    forwardRef(() => TransactionModule),
  ],
  controllers: [DividendController],
  providers: [DividendService, PrismaService, DividendAnalysisService],
  exports: [DividendService, DividendAnalysisService], // หาก Service อื่นต้องการใช้ DividendService
})
export class DividendModule {}
