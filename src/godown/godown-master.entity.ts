import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('godowns')
@Index('idx_godowns_tenant_code', ['tenantId', 'code'], { unique: true })
export class GodownMaster {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  location?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ name: 'capacity_birds', type: 'integer', nullable: true })
  capacityBirds?: number;

  @Column({ name: 'manager_name', type: 'varchar', length: 150, nullable: true })
  managerName?: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone?: string;

  @Column({ type: 'enum', enum: ['active', 'inactive'], enumName: 'godown_status_enum', default: 'active' })
  status!: 'active' | 'inactive';

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true })
  tenantId?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
