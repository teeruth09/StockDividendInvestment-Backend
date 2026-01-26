import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { StockModule } from './stock/stock.module';
import { TransactionModule } from './transaction/transaction.module';
import { ConfigModule } from '@nestjs/config';
import { DividendModule } from './dividend/dividend.module';
import { TaxCreditModule } from './taxCredit/taxCredit.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { TaxModule } from './tax/tax.module';
import { ScheduleModule } from '@nestjs/schedule';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'production'
          ? '.env.production'
          : '.env.development',
    }),
    ScheduleModule.forRoot(), // Job Schedule
    UserModule,
    AuthModule,
    StockModule,
    TransactionModule,
    DividendModule,
    TaxCreditModule,
    PortfolioModule,
    TaxModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
