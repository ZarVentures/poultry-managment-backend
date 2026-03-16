import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { PurchaseOrderCage } from './purchase-order-cage.entity';

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

  // Invoice header fields
  @Column({ name: 'branch', type: 'varchar', length: 100, nullable: true })
  branch?: string;

  @Column({ name: 'unit', type: 'varchar', length: 100, nullable: true })
  unit?: string;

  @Column({ name: 'gstin', type: 'varchar', length: 20, nullable: true })
  gstin?: string;

  @Column({ name: 'lifting_time', type: 'varchar', length: 50, nullable: true })
  liftingTime?: string;

  @Column({ name: 'party_code', type: 'varchar', length: 50, nullable: true })
  partyCode?: string;

  @Column({ name: 'pr_number', type: 'varchar', length: 50, nullable: true })
  prNumber?: string;

  @Column({ name: 'hsn_code', type: 'varchar', length: 20, nullable: true, default: '0105' })
  hsnCode?: string;

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

  // Bird details
  @Column({ name: 'bird_type', type: 'varchar', length: 50, nullable: true })
  birdType?: string;

  @Column({ name: 'total_weight', type: 'numeric', precision: 10, scale: 2, default: 0 })
  totalWeight!: number;

  @Column({ name: 'rate_per_kg', type: 'numeric', precision: 10, scale: 2, default: 0 })
  ratePerKg!: number;

  @Column({ name: 'total_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalAmount!: number;

  @Column({ name: 'transport_charges', type: 'numeric', precision: 10, scale: 2, default: 0 })
  transportCharges!: number;

  @Column({ name: 'loading_charges', type: 'numeric', precision: 10, scale: 2, default: 0 })
  loadingCharges!: number;

  @Column({ name: 'commission', type: 'numeric', precision: 10, scale: 2, default: 0 })
  commission!: number;

  @Column({ name: 'other_charges', type: 'numeric', precision: 10, scale: 2, default: 0 })
  otherCharges!: number;

  @Column({ name: 'weight_shortage', type: 'numeric', precision: 10, scale: 2, default: 0 })
  weightShortage!: number;

  @Column({ name: 'mortality_deduction', type: 'numeric', precision: 10, scale: 2, default: 0 })
  mortalityDeduction!: number;

  @Column({ name: 'other_deduction', type: 'numeric', precision: 10, scale: 2, default: 0 })
  otherDeduction!: number;

  @Column({ name: 'gross_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  grossAmount!: number;

  @Column({ name: 'net_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  netAmount!: number;

  // Payment tracking
  @Column({ name: 'purchase_payment_status', type: 'varchar', length: 20, default: 'pending' })
  purchasePaymentStatus!: PurchasePaymentStatus;

  @Column({ name: 'advance_paid', type: 'numeric', precision: 14, scale: 2, default: 0 })
  advancePaid!: number;

  @Column({ name: 'outstanding_payment', type: 'numeric', precision: 14, scale: 2, default: 0 })
  outstandingPayment!: number;

  @Column({ name: 'payment_mode', type: 'varchar', length: 50, nullable: true })
  paymentMode?: string;

  @Column({ name: 'total_payment_made', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalPaymentMade!: number;

  @Column({ name: 'balance_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  balanceAmount!: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, { cascade: true })
  items!: PurchaseOrderItem[];

  @OneToMany(() => PurchaseOrderCage, (cage) => cage.purchaseOrder, { cascade: true })
  cages!: PurchaseOrderCage[];

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}