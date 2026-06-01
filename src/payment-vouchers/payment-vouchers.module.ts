import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentVouchersService } from './payment-vouchers.service';
import { PaymentVouchersController } from './payment-vouchers.controller';
import { BillingModule } from '../billing/billing.module';
import { PaymentVoucher } from './payment-voucher.entity';
import { AccountingModule } from '../modules/accounting/accounting.module';
import { RetailersModule } from '../retailers/retailers.module';
import { FarmersModule } from '../farmers/farmers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentVoucher]),
    BillingModule,
    AccountingModule,
    RetailersModule,
    FarmersModule,
  ],
  controllers: [PaymentVouchersController],
  providers: [PaymentVouchersService],
  exports: [PaymentVouchersService],
})
export class PaymentVouchersModule { }
