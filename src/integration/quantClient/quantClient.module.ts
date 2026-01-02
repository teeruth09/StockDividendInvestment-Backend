import { HttpModule } from '@nestjs/axios';
import { QuantClientService } from './quantClient.service';
import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Module({
  imports: [HttpModule],
  controllers: [],
  providers: [QuantClientService, PrismaService],
  exports: [QuantClientService],
})
export class QuantClientModule {}
