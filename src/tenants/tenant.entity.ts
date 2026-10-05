import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'tenants' })
export class Tenant {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  type?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 20, default: 'INR' })
  currency!: string;

  @Column({ name: 'country_code', type: 'varchar', length: 10, default: '+91' })
  countryCode?: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  plan?: string | null;

  @Column({ name: 'billing_period', type: 'varchar', length: 20, nullable: true })
  billingPeriod?: string | null;

  @Column({ name: 'subscription_status', type: 'varchar', length: 20, nullable: true })
  subscriptionStatus?: string | null;

  @Column({ name: 'trial_ends_at', type: 'timestamptz', nullable: true })
  trialEndsAt?: Date | null;

  @Column({ name: 'current_period_ends_at', type: 'timestamptz', nullable: true })
  currentPeriodEndsAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}