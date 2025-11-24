import { Module } from '@nestjs/common';
import { DividendService } from './dividend.service';
import { DividendController } from './dividend.controller';
import { TaxCreditModule } from '../taxCredit/taxCredit.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { PrismaService } from 'src/prisma.service';

@Module({
  imports: [TaxCreditModule, PortfolioModule],
  controllers: [DividendController],
  providers: [DividendService, PrismaService],
  exports: [DividendService], // หาก Service อื่นต้องการใช้ DividendService
})
export class DividendModule {}
