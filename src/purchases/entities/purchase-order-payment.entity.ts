import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';

export type PaymentMode = 'cash' | 'upi' | 'card' | 'cheque' | 'bank_transfer';

@Entity({ name: 'purchase_order_payments' })
export class PurchaseOrderPayment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'purchase_order_id', type: 'bigint' })
  purchaseOrderId!: string;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true })
  tenantId?: string;

  @Column({ name: 'payment_mode', type: 'varchar', length: 30 })
  paymentMode!: PaymentMode;

  @Column({ name: 'amount', type: 'numeric', precision: 14, scale: 2 })
  amount!: number;

  @Column({ name: 'is_advance', type: 'boolean', default: false })
  isAdvance!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @ManyToOne(() => PurchaseOrder, (po) => po.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder!: PurchaseOrder;
}
