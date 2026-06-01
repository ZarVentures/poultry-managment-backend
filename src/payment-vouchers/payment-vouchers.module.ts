import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentVouchersService } from './payment-vouchers.service';
import { PaymentVouchersController } from './payment-vouchers.controller';
import { BillingModule } from '../billing/billing.module';
import { PaymentVoucher } from './payment-voucher.entity';
import { AccountingModule } from '../modules/accounting/accounting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentVoucher]),
    BillingModule,
    AccountingModule,
  ],
  controllers: [PaymentVouchersController],
  providers: [PaymentVouchersService],
  exports: [PaymentVouchersService],
})
export class PaymentVouchersModule { }
