import { IsIn } from 'class-validator';

export class CreateSubscriptionOrderDto {
  @IsIn(['starter', 'professional'])
  plan!: 'starter' | 'professional';

  @IsIn(['monthly', 'yearly'])
  billingPeriod!: 'monthly' | 'yearly';
}
