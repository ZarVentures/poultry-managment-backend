import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PurchaseOrder } from '../purchases/entities/purchase-order.entity';

@Entity({ name: 'mortalities' })
export class Mortality {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'record_number', type: 'varchar', length: 50, unique: true })
  recordNumber!: string;

  @Column({ name: 'purchase_order_id', type: 'bigint', nullable: true })
  purchaseOrderId?: string;

  @ManyToOne(() => PurchaseOrder, { nullable: true })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder?: PurchaseOrder;

  @Column({ name: 'purchase_invoice_no', type: 'varchar', length: 50 })
  purchaseInvoiceNo!: string;

  @Column({ name: 'purchase_date', type: 'date' })
  purchaseDate!: string;

  @Column({ name: 'farmer_name', type: 'varchar', length: 150 })
  farmerName!: string;

  @Column({ name: 'farm_location', type: 'text', nullable: true })
  farmLocation?: string;

  @Column({ name: 'cage_id_number', type: 'varchar', length: 50, nullable: true })
  cageIdNumber?: string;

  @Column({ name: 'total_birds_purchased', type: 'integer', default: 0 })
  totalBirdsPurchased!: number;

  @Column({ name: 'number_of_birds_died', type: 'integer' })
  numberOfBirdsDied!: number;

  @Column({ name: 'weight_of_dead_birds', type: 'numeric', precision: 10, scale: 2, nullable: true })
  weightOfDeadBirds?: number;

  @Column({ name: 'cause', type: 'text' })
  cause!: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
