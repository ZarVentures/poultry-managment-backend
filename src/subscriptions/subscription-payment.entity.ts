import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'subscription_payments' })
export class SubscriptionPayment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 50 })
  plan!: string;

  @Column({ name: 'billing_period', type: 'varchar', length: 20 })
  billingPeriod!: string;

  @Column({ name: 'amount_paise', type: 'int' })
  amountPaise!: number;

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency!: string;

  @Column({ name: 'razorpay_order_id', type: 'varchar', length: 100 })
  razorpayOrderId!: string;

  @Column({ name: 'razorpay_payment_id', type: 'varchar', length: 100, nullable: true })
  razorpayPaymentId?: string | null;

  @Column({ type: 'varchar', length: 30, default: 'created' })
  status!: string;

  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true })
  rawPayload?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
