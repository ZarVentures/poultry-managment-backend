import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Sale } from '../sale.entity';
import { Retailer } from '../../retailers/retailer.entity';

export type ReturnReasonType = 'dead' | 'sick' | 'underweight' | 'quality_issue' | 'customer_request' | 'other';
export type ReturnStatusType = 'pending' | 'approved' | 'rejected' | 'processed';

@Entity({ name: 'bird_returns' })
export class BirdReturn {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'return_number', type: 'varchar', length: 50, unique: true })
  returnNumber!: string;

  @Column({ name: 'return_date', type: 'date' })
  returnDate!: string;

  // Reference to original sale
  @Column({ name: 'sale_id', type: 'bigint' })
  saleId!: string;

  @ManyToOne(() => Sale)
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale;

  // Customer/Retailer info
  @Column({ name: 'customer_name', type: 'varchar', length: 150 })
  customerName!: string;

  @Column({ name: 'retailer_id', type: 'bigint', nullable: true })
  retailerId?: string;

  @ManyToOne(() => Retailer, { nullable: true })
  @JoinColumn({ name: 'retailer_id' })
  retailer?: Retailer;

  // Return details
  @Column({ name: 'number_of_birds_returned', type: 'integer' })
  numberOfBirdsReturned!: number;

  @Column({ name: 'weight_returned', type: 'numeric', precision: 10, scale: 2, nullable: true })
  weightReturned?: number;

  @Column({
    name: 'return_reason',
    type: 'enum',
    enum: ['dead', 'sick', 'underweight', 'quality_issue', 'customer_request', 'other'],
    enumName: 'return_reason_type',
  })
  returnReason!: ReturnReasonType;

  @Column({ name: 'reason_description', type: 'text', nullable: true })
  reasonDescription?: string;

  // Financial impact
  @Column({ name: 'refund_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  refundAmount!: number;

  @Column({ name: 'adjustment_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  adjustmentAmount!: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['pending', 'approved', 'rejected', 'processed'],
    enumName: 'return_status_type',
    default: 'pending',
  })
  status!: ReturnStatusType;

  // Inventory impact
  @Column({ name: 'returned_to_inventory', type: 'boolean', default: false })
  returnedToInventory!: boolean;

  @Column({ name: 'inventory_location', type: 'varchar', length: 100, nullable: true })
  inventoryLocation?: string;

  // Approval tracking
  @Column({ name: 'approved_by', type: 'varchar', length: 150, nullable: true })
  approvedBy?: string;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @Column({ name: 'processed_by', type: 'varchar', length: 150, nullable: true })
  processedBy?: string;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'attachment_url', type: 'text', nullable: true })
  attachmentUrl?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
