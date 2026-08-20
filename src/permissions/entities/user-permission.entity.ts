import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/user.entity';

@Entity({ name: 'user_permissions' })
export class UserPermission {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'permission_name', type: 'varchar', length: 100 })
  permissionName!: string;

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
