import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';

export type CageStatus = 'pending' | 'sold' | 'in_godown';

@Entity({ name: 'purchase_order_cages' })
export class PurchaseOrderCage {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'purchase_order_id', type: 'bigint' })
  purchaseOrderId!: string;

  @Column({ name: 'cage_id', type: 'varchar', length: 50, nullable: true })
  cageId?: string;

  @Column({ name: 'bird_type', type: 'varchar', length: 50, nullable: true })
  birdType?: string;

  @Column({ name: 'number_of_birds', type: 'integer' })
  numberOfBirds!: number;

  @Column({ name: 'cage_weight', type: 'numeric', precision: 10, scale: 2 })
  cageWeight!: number;

  // Status tracks cage lifecycle: pending → sold (via Sale) or in_godown (via Godown Inward)
  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status!: CageStatus;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @ManyToOne(() => PurchaseOrder, (purchaseOrder) => purchaseOrder.cages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder!: PurchaseOrder;
}
