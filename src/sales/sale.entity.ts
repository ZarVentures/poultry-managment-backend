import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Retailer } from '../retailers/retailer.entity';

export type SaleProductType = 'eggs' | 'meat' | 'chicks' | 'other';
export type PaymentStatusType = 'paid' | 'pending' | 'partial';
export type SaleModeType = 'from_vehicle' | 'from_godown';

@Entity({ name: 'sales' })
export class Sale {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50, unique: true })
  invoiceNumber!: string;

  @Column({ name: 'customer_name', type: 'varchar', length: 150 })
  customerName!: string;

  @Column({ name: 'sale_date', type: 'date' })
  saleDate!: string;

  @Column({
    name: 'sale_mode',
    type: 'enum',
    enum: ['from_vehicle', 'from_godown'],
    enumName: 'sale_mode_type',
    default: 'from_vehicle',
  })
  saleMode!: SaleModeType;

  @Column({
    name: 'product_type',
    type: 'enum',
    enum: ['eggs', 'meat', 'chicks', 'other'],
    enumName: 'sale_product_type',
  })
  productType!: SaleProductType;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  quantity!: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unit?: string;

  @Column({ name: 'unit_price', type: 'numeric', precision: 14, scale: 2 })
  unitPrice!: number;

  @Column({ name: 'total_amount', type: 'numeric', precision: 14, scale: 2 })
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

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: ['paid', 'pending', 'partial'],
    enumName: 'payment_status_type',
    default: 'pending',
  })
  paymentStatus!: PaymentStatusType;

  @Column({ name: 'amount_received', type: 'numeric', precision: 14, scale: 2, default: 0 })
  amountReceived!: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'retailer_id', type: 'bigint', nullable: true })
  retailerId?: string;

  @Column({ name: 'sale_attachment', type: 'text', nullable: true })
  saleAttachment?: string;

  @ManyToOne(() => Retailer, { nullable: true })
  @JoinColumn({ name: 'retailer_id' })
  retailer?: Retailer;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}