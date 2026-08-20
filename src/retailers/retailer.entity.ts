import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'retailers' })
export class Retailer {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'owner_name', type: 'varchar', length: 150, nullable: true })
  ownerName?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @Column({ name: 'opening_balance', type: 'numeric', precision: 14, scale: 2, default: 0 })
  openingBalance!: number;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true })
  tenantId?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}