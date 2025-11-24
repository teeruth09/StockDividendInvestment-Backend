import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { PrismaService } from 'src/prisma.service';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [StockModule],
  providers: [TransactionService, PrismaService],
  controllers: [TransactionController],
  exports: [TransactionService],
})
export class TransactionModule {}
