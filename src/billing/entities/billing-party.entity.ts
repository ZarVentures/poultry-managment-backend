import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { BillingSale } from './billing-sale.entity';
import { BillingPayment } from './billing-payment.entity';
import { BillingLedger } from './billing-ledger.entity';

export type PartyType = 'Retailer' | 'Farm' | 'Trader' | 'Distributor';

@Entity({ name: 'billing_parties' })
export class BillingParty {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 20, default: 'Retailer' })
  type!: PartyType;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ name: 'opening_balance', type: 'numeric', precision: 14, scale: 2, default: 0 })
  openingBalance!: number;

  @Column({ name: 'current_balance', type: 'numeric', precision: 14, scale: 2, default: 0 })
  currentBalance!: number;

  @Column({ name: 'credit_limit', type: 'numeric', precision: 14, scale: 2, default: 0 })
  creditLimit!: number;

  @Column({ name: 'payment_terms', type: 'integer', default: 30 })
  paymentTerms!: number;

  @OneToMany(() => BillingSale, (s) => s.party, { cascade: true })
  sales!: BillingSale[];

  @OneToMany(() => BillingPayment, (p) => p.party, { cascade: true })
  payments!: BillingPayment[];

  @OneToMany(() => BillingLedger, (l) => l.party, { cascade: true })
  ledger!: BillingLedger[];

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true })
  tenantId?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
