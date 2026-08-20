import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BillingParty } from './billing-party.entity';

export type PaymentMode = 'Cash' | 'Bank' | 'UPI' | 'Cheque';
export type PaymentStatus = 'Completed' | 'Pending' | 'Failed';

@Entity({ name: 'billing_payments' })
export class BillingPayment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'party_id', type: 'bigint' })
  partyId!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', length: 20, default: 'Cash' })
  mode!: PaymentMode;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  amount!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference?: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({ type: 'varchar', length: 20, default: 'Pending' })
  status!: PaymentStatus;

  @ManyToOne(() => BillingParty, (p) => p.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'party_id' })
  party!: BillingParty;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true })
  tenantId?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
