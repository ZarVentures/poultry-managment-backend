import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint', nullable: true })
  userId?: string;

  @Column({ name: 'user_email', type: 'varchar', length: 255, nullable: true })
  userEmail?: string;

  @Column({ type: 'varchar', length: 50 })
  action!: string; // CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.

  @Column({ type: 'varchar', length: 100 })
  entity!: string; // users, vehicles, sales, etc.

  @Column({ name: 'entity_id', type: 'varchar', length: 100, nullable: true })
  entityId?: string;

  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues?: Record<string, any>;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues?: Record<string, any>;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true })
  tenantId?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
