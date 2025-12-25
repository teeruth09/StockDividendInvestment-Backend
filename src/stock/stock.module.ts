import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { PrismaService } from 'src/prisma.service';
import { StockSyncService } from './stock.sync.service';

@Module({
  providers: [StockService, PrismaService, StockSyncService],
  controllers: [StockController],
  exports: [StockService],
})
export class StockModule {}
