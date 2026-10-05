import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { RazorpayService } from './razorpay.service';
import { SubscriptionGuard } from './subscription.guard';
import { SubscriptionPayment } from './subscription-payment.entity';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, SubscriptionPayment])],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    RazorpayService,
    {
      provide: APP_INTERCEPTOR,
      useClass: SubscriptionGuard,
    },
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
