import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export type ProductType = 'eggs' | 'meat' | 'chicks' | 'feed' | 'medicine' | 'equipment' | 'other';
export type ProductStatus = 'active' | 'inactive';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category?: string;

  @Column({
    name: 'product_type',
    type: 'enum',
    enum: ['eggs', 'meat', 'chicks', 'feed', 'medicine', 'equipment', 'other'],
    enumName: 'product_type_enum',
    nullable: true,
  })
  productType?: ProductType;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unit?: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  price?: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive'],
    enumName: 'product_status_enum',
    default: 'active',
  })
  status!: ProductStatus;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true })
  tenantId?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
