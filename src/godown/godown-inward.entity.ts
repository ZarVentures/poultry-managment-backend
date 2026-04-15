import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('godown_inward_entries')
export class GodownInwardEntry {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'entry_date', type: 'date' })
  entryDate!: string;

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

  @Column({ name: 'total_weight', type: 'numeric', precision: 10, scale: 2, nullable: true })
  totalWeight?: number;

  @Column({ name: 'rate_per_kg', type: 'numeric', precision: 10, scale: 2, nullable: true })
  ratePerKg?: number;

  @Column({ name: 'total_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  totalAmount?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
