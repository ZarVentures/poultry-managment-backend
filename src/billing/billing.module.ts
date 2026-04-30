import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { BillingParty } from './entities/billing-party.entity';
import { BillingSale } from './entities/billing-sale.entity';
import { BillingPayment } from './entities/billing-payment.entity';
import { BillingLedger } from './entities/billing-ledger.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BillingParty, BillingSale, BillingPayment, BillingLedger])],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
