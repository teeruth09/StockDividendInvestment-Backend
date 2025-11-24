import { Module } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [PrismaService, PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
