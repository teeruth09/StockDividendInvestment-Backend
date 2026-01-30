import { forwardRef, Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { PrismaService } from 'src/prisma.service';
import { StockModule } from '../stock/stock.module';
import { DividendModule } from 'src/dividend/dividend.module';
import { PortfolioModule } from 'src/portfolio/portfolio.module';

@Module({
  imports: [
    StockModule,
    forwardRef(() => DividendModule),
    forwardRef(() => PortfolioModule),
  ],
  providers: [TransactionService, PrismaService],
  controllers: [TransactionController],
  exports: [TransactionService],
})
export class TransactionModule {}
