import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import {
  Transaction,
  TransactionInput,
  TransactionType,
} from './transaction.model';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  // **********************************************
  // 1. ซื้อหุ้น (Create Buy Transaction)
  // [POST] /transactions/buy
  // **********************************************
  @Post('buy')
  async createBuyTransaction(
    @Body() transactionData: TransactionInput,
  ): Promise<Transaction> {
    return this.transactionService.createTransaction(
      transactionData,
      TransactionType.BUY, // ส่ง Type เป็น BUY
    );
  }

  // **********************************************
  // 2. ขายหุ้น (Create Sell Transaction)
  // [POST] /transactions/sell
  // **********************************************
  @Post('sell')
  async createSellTransaction(
    @Body() transactionData: TransactionInput,
  ): Promise<Transaction> {
    return this.transactionService.createTransaction(
      transactionData,
      TransactionType.SELL, // ส่ง Type เป็น SELL
    );
  }

  //   // **********************************************
  //   // 4. ลบรายการ Transaction
  //   // [DELETE] /transactions/:id
  //   // **********************************************
  //   @Delete(':id')
  //   async remove(
  //     // @CurrentUser('user_id') userId: string,
  //     @Param('id') id: string, // Transaction ID
  //   ): Promise<Transaction> {
  //     const mockUserId = 'user-123'; // ❌ เปลี่ยนเป็น userId จริง

  //     // ID ใน Prisma เป็น String (cuid) ใน Schema แต่ใน Controller รับเป็น String
  //     return this.transactionService.remove(id, mockUserId);
  //   }
}
