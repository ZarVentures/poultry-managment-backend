import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BillingParty } from './billing-party.entity';

@Entity({ name: 'billing_sales' })
export class BillingSale {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'party_id', type: 'bigint' })
  partyId!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'integer', default: 0 })
  birds!: number;

  @Column({ name: 'net_weight', type: 'numeric', precision: 10, scale: 2, default: 0 })
  netWeight!: number;

  @Column({ name: 'avg_weight', type: 'numeric', precision: 10, scale: 2, default: 0 })
  avgWeight!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  rate!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  discount!: number;

  @Column({ name: 'total_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalAmount!: number;

  @Column({ name: 'vehicle_no', type: 'varchar', length: 50, nullable: true })
  vehicleNo?: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @ManyToOne(() => BillingParty, (p) => p.sales, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'party_id' })
  party!: BillingParty;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
