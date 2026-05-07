import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { GodownSale } from './godown-sale.entity';

@Entity({ name: 'godown_sale_payments' })
export class GodownSalePayment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'godown_sale_id', type: 'bigint' })
  godownSaleId!: string;

  @Column({ name: 'payment_mode', type: 'varchar', length: 30 })
  paymentMode!: string;

  @Column({ name: 'amount', type: 'numeric', precision: 14, scale: 2 })
  amount!: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @ManyToOne(() => GodownSale, (sale) => sale.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'godown_sale_id' })
  godownSale!: GodownSale;
}
