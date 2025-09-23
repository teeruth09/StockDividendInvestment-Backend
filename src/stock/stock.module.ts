import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [StockService, PrismaService],
  controllers: [StockController],
  exports: [StockService],
})
export class StockModule {}
