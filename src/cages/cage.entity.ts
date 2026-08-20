import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PurchaseOrder } from '../purchases/entities/purchase-order.entity';

export type CageStatus =
  | 'pending'       // just purchased, not yet dispatched
  | 'on_vehicle'    // loaded on vehicle for sale
  | 'sold'          // sold to retailer from vehicle
  | 'in_godown'     // returned to godown
  | 'godown_sold';  // sold from godown

@Entity({ name: 'cages' })
export class Cage {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  // Physical cage label (e.g. "C1", "C2")
  @Column({ name: 'cage_id', type: 'varchar', length: 50, nullable: true })
  cageId?: string;

  // Origin — which purchase this cage came from
  @Column({ name: 'purchase_order_id', type: 'bigint' })
  purchaseOrderId!: string;

  @Column({ name: 'number_of_birds', type: 'integer', default: 0 })
  numberOfBirds!: number;

  // Weight at each stage
  @Column({ name: 'purchase_weight', type: 'numeric', precision: 10, scale: 2, default: 0 })
  purchaseWeight!: number;

  @Column({ name: 'sale_weight', type: 'numeric', precision: 10, scale: 2, nullable: true })
  saleWeight?: number;

  @Column({ name: 'godown_inward_weight', type: 'numeric', precision: 10, scale: 2, nullable: true })
  godownInwardWeight?: number;

  @Column({ name: 'godown_sale_weight', type: 'numeric', precision: 10, scale: 2, nullable: true })
  godownSaleWeight?: number;

  // Current status
  @Column({ name: 'status', type: 'varchar', length: 20, default: 'pending' })
  status!: CageStatus;

  // Which vehicle currently has this cage (when on_vehicle)
  @Column({ name: 'vehicle_id', type: 'bigint', nullable: true })
  vehicleId?: string;

  // References to transactions
  @Column({ name: 'sale_id', type: 'bigint', nullable: true })
  saleId?: string;

  @Column({ name: 'godown_inward_id', type: 'bigint', nullable: true })
  godownInwardId?: string;

  @Column({ name: 'godown_sale_id', type: 'bigint', nullable: true })
  godownSaleId?: string;

  @ManyToOne(() => PurchaseOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder!: PurchaseOrder;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true })
  tenantId?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
