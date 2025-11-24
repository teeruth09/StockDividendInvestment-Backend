import { Module, forwardRef } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { PrismaService } from 'src/prisma.service';
import { StockModule } from 'src/stock/stock.module';
import { DividendModule } from 'src/dividend/dividend.module';
import { PortfolioController } from './portfolio.controller';

@Module({
  imports: [StockModule, forwardRef(() => DividendModule)],
  controllers: [PortfolioController],
  providers: [PrismaService, PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
