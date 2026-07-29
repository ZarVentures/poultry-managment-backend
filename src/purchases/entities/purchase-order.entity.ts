import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { PurchaseOrderPayment } from './purchase-order-payment.entity';
import { Cage } from '../../cages/cage.entity';

export type PurchaseStatus = 'pending' | 'received' | 'cancelled';
export type PurchasePaymentStatus = 'paid' | 'pending' | 'partial';

@Entity({ name: 'purchase_orders' })
export class PurchaseOrder {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'order_number', type: 'varchar', length: 50, unique: true })
  orderNumber!: string;

  @Column({ name: 'supplier_name', type: 'varchar', length: 150 })
  supplierName!: string;

  @Column({ name: 'order_date', type: 'date' })
  orderDate!: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate?: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'received', 'cancelled'],
    enumName: 'purchase_status',
    default: 'pending',
  })
  status!: PurchaseStatus;

  // Header fields (kept)
  @Column({ name: 'branch', type: 'varchar', length: 100, nullable: true })
  branch?: string;

  // Farmer integration
  @Column({ name: 'farmer_id', type: 'bigint', nullable: true })
  farmerId?: string;

  @Column({ name: 'farmer_mobile', type: 'varchar', length: 20, nullable: true })
  farmerMobile?: string;

  @Column({ name: 'farm_location', type: 'text', nullable: true })
  farmLocation?: string;

  // Vehicle integration
  @Column({ name: 'vehicle_id', type: 'bigint', nullable: true })
  vehicleId?: string;

  // Bird details (bird_type removed — broiler only)
  @Column({ name: 'total_weight', type: 'numeric', precision: 10, scale: 2, default: 0 })
  totalWeight!: number;

  @Column({ name: 'rate_per_kg', type: 'numeric', precision: 10, scale: 2, default: 0 })
  ratePerKg!: number;

  @Column({ name: 'total_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalAmount!: number;

  // Charges (loading, commission, deductions removed)
  @Column({ name: 'transport_charges', type: 'numeric', precision: 10, scale: 2, default: 0 })
  transportCharges!: number;

  @Column({ name: 'other_charges', type: 'numeric', precision: 10, scale: 2, default: 0 })
  otherCharges!: number;

  @Column({ name: 'gross_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  grossAmount!: number;

  @Column({ name: 'mortality_deduction', type: 'numeric', precision: 10, scale: 2, default: 0 })
  mortalityDeduction!: number;

  @Column({ name: 'net_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  netAmount!: number;

  // Payment tracking
  @Column({ name: 'purchase_payment_status', type: 'varchar', length: 20, default: 'pending' })
  purchasePaymentStatus!: PurchasePaymentStatus;

  @Column({ name: 'total_payment_made', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalPaymentMade!: number;

  @Column({ name: 'balance_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  balanceAmount!: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'invoice_attachment', type: 'varchar', length: 500, nullable: true })
  invoiceAttachment?: string;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, { cascade: true })
  items!: PurchaseOrderItem[];

  @OneToMany(() => PurchaseOrderPayment, (payment) => payment.purchaseOrder, { cascade: true })
  payments!: PurchaseOrderPayment[];

  @OneToMany(() => Cage, (cage) => cage.purchaseOrder)
  cages!: Cage[];

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
