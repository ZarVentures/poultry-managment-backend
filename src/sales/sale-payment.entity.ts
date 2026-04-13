import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Sale } from './sale.entity';

@Entity({ name: 'sale_payments' })
export class SalePayment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'sale_id', type: 'bigint' })
  saleId!: string;

  @Column({ name: 'payment_mode', type: 'varchar', length: 30 })
  paymentMode!: string;

  @Column({ name: 'amount', type: 'numeric', precision: 14, scale: 2 })
  amount!: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @ManyToOne(() => Sale, (sale) => sale.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale;
}
