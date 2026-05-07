import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { GodownSale } from './godown-sale.entity';

@Entity('godown_sale_payments')
export class GodownSalePayment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'godown_sale_id', type: 'bigint' })
  godownSaleId!: string;

  @Column({ name: 'payment_mode', type: 'varchar', length: 50 })
  paymentMode!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount!: number;

  @Column({ name: 'is_advance', type: 'boolean', default: false })
  isAdvance!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @ManyToOne(() => GodownSale, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'godown_sale_id' })
  godownSale?: GodownSale;
}
