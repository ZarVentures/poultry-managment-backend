import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'item_type', length: 50 })
  itemType: string;

  @Column({ name: 'item_name', length: 150 })
  itemName: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  quantity: number;

  @Column({ length: 20 })
  unit: string;

  @Column({ name: 'minimum_stock_level', type: 'decimal', precision: 14, scale: 2, default: 0 })
  minimumStockLevel: number;

  @Column({ name: 'current_stock_level', type: 'decimal', precision: 10, scale: 2, default: 0 })
  currentStockLevel: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true })
  tenantId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'last_updated', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastUpdated: Date;
}
