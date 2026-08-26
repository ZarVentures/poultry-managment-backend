import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { GodownMaster } from './godown-master.entity';

@Entity('godown_inward_entries')
export class GodownInwardEntry {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'godown_id', type: 'bigint', nullable: true })
  godownId?: string;

  @ManyToOne(() => GodownMaster, { nullable: true })
  @JoinColumn({ name: 'godown_id' })
  godown?: GodownMaster;

  @Column({ name: 'entry_date', type: 'date' })
  entryDate!: string;

  @Column({ name: 'inward_no', type: 'varchar', length: 50, nullable: true })
  inwardNo?: string;

  @Column({ name: 'purchase_invoice_no', type: 'varchar', length: 50, nullable: true })
  purchaseInvoiceNo?: string;


  @Column({ name: 'supplier_name', type: 'varchar', length: 150, nullable: true })
  supplierName?: string;

  @Column({ name: 'vehicle_id', type: 'bigint', nullable: true })
  vehicleId?: string;

  @Column({ name: 'number_of_birds', type: 'integer' })
  numberOfBirds!: number;

  @Column({ name: 'average_weight', type: 'numeric', precision: 10, scale: 2, nullable: true })
  averageWeight?: number;

  @Column({ name: 'actual_weight', type: 'numeric', precision: 10, scale: 2, nullable: true })
  actualWeight?: number;

  @Column({ name: 'weight_loss', type: 'numeric', precision: 10, scale: 2, default: 0 })
  weightLoss!: number;

  @Column({ name: 'total_weight', type: 'numeric', precision: 10, scale: 2, nullable: true })
  totalWeight?: number; // This will store the final available stock weight

  @Column({ name: 'rate_per_kg', type: 'numeric', precision: 10, scale: 2, nullable: true })
  ratePerKg?: number;

  @Column({ name: 'total_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  totalAmount?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true })
  tenantId?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
