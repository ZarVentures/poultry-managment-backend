import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { GodownSalePayment } from './godown-sale-payment.entity';

@Entity('godown_sales')
export class GodownSale {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'sale_date', type: 'date' })
  saleDate!: string;

  @Column({ name: 'sale_no', type: 'varchar', length: 50, nullable: true })
  saleNo?: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50, nullable: true })
  invoiceNumber?: string;

  @Column({ name: 'customer_name', type: 'varchar', length: 150 })
  customerName!: string;

  @Column({ name: 'retailer_id', type: 'bigint', nullable: true })
  retailerId?: string;

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

  @Column({ name: 'payment_status', type: 'enum', enum: ['paid', 'pending', 'partial'] })
  paymentStatus!: 'paid' | 'pending' | 'partial';

  @Column({ name: 'weight_loss', type: 'numeric', precision: 10, scale: 2, default: 0 })
  weightLoss!: number;

  @Column({ name: 'payment_mode', type: 'varchar', length: 50, nullable: true })
  paymentMode?: string;

  @Column({ name: 'amount_received', type: 'numeric', precision: 14, scale: 2 })
  amountReceived!: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;

  @OneToMany(() => GodownSalePayment, (payment) => payment.godownSale, { cascade: true })
  payments!: GodownSalePayment[];
}
