import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BillingParty } from './billing-party.entity';

export type LedgerReferenceType = 'Opening' | 'Sale' | 'Payment';

@Entity({ name: 'billing_ledger' })
export class BillingLedger {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'party_id', type: 'bigint' })
  partyId!: string;

  @Column({ name: 'reference_type', type: 'varchar', length: 20 })
  referenceType!: LedgerReferenceType;

  @Column({ name: 'reference_id', type: 'varchar', length: 50, nullable: true })
  referenceId?: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  debit!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  credit!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  balance!: number;

  @Column({ type: 'date' })
  date!: string;

  @ManyToOne(() => BillingParty, (p) => p.ledger, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'party_id' })
  party!: BillingParty;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
