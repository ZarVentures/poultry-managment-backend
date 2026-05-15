import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentVouchersService } from './payment-vouchers.service';
import { PaymentVouchersController } from './payment-vouchers.controller';
import { BillingModule } from '../billing/billing.module';
import { PaymentVoucher } from './payment-voucher.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentVoucher]),
    BillingModule,
  ],
  controllers: [PaymentVouchersController],
  providers: [PaymentVouchersService],
  exports: [PaymentVouchersService],
})
export class PaymentVouchersModule { }
