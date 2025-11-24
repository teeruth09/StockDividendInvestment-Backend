import { TransactionService } from './../transaction/transaction.service';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User, UserTaxInfoDto } from './user.model';
import { Transaction } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('user')
export class UserController {
  constructor(
    private userService: UserService,
    private transactionService: TransactionService,
  ) {}

  @Get('users')
  async getAllUsers(): Promise<User[]> {
    return this.userService.getAllUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('tax-info')
  async getUserTaxInfo(@Req() req, @Query('taxYear') taxYear: string) {
    const userId = req.user.user_id;
    const taxYearNumber = parseInt(taxYear, 10);
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }
    if (isNaN(taxYearNumber)) {
      throw new BadRequestException('taxYear must be a number');
    }
    return this.userService.getUserTaxInfo(userId, taxYearNumber);
  }

  @UseGuards(JwtAuthGuard)
  @Post('tax-info')
  async updateUserTaxInfo(@Req() req, @Body() body: UserTaxInfoDto) {
    const userId = req.user.user_id;
    return this.userService.updateUserTaxInfo(userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':username')
  async getUser(@Param('username') username: string): Promise<User> {
    const user = await this.userService.getUser(username);
    if (!user) {
      throw new NotFoundException(`User with ID ${username} not found`);
    }
    return user;
  }

  @Put(':username')
  async updateUser(
    @Param('username') username: string,
    @Body() postData: User,
  ): Promise<User> {
    return this.userService.updateUser(username, postData);
  }

  // [GET] /transactions User
  @Get(':username/transactions')
  async findAllUserTransactions(
    @Param('username') username: string,
    @Query('symbol') symbol?: string,
  ): Promise<Transaction[]> {
    const user = await this.userService.getUser(username);
    if (!user) {
      throw new NotFoundException(`User with ID ${username} not found`);
    }
    const userId = user.user_id;
    return this.transactionService.findAll(userId, symbol);
  }
}
