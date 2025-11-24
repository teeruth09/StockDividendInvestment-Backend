import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { TaxCreditService } from './taxCredit.service';

@Module({
  providers: [TaxCreditService, PrismaService],
  exports: [TaxCreditService],
})
export class TaxCreditModule {}
