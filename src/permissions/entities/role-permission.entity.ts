import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'role_permissions' })
export class RolePermission {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: string;

  @Column({ type: 'varchar', length: 50 })
  resource!: string;

  @Column({ name: 'can_create', type: 'boolean', default: false })
  canCreate!: boolean;

  @Column({ name: 'can_read', type: 'boolean', default: true })
  canRead!: boolean;

  @Column({ name: 'can_update', type: 'boolean', default: false })
  canUpdate!: boolean;

  @Column({ name: 'can_delete', type: 'boolean', default: false })
  canDelete!: boolean;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true })
  tenantId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
