import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Exclude } from 'class-transformer';

export type UserRole = string;
export type UserStatus = 'active' | 'inactive';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'citext', nullable: true })
  email?: string;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true })
  tenantId?: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  phone!: string;

  @Exclude()
  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash?: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'manager',
  })
  role!: string;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive'],
    enumName: 'user_status',
    default: 'active',
  })
  status!: UserStatus;

  @Column({ name: 'join_date', type: 'date', default: () => 'CURRENT_DATE' })
  joinDate!: string;

  @Column({ name: 'last_login', type: 'timestamptz', nullable: true })
  lastLogin?: Date | null;

  // Tracks the current active session token — only the latest login is valid
  @Column({ name: 'session_token', type: 'text', nullable: true })
  sessionToken?: string | null;

  // Two-Factor Authentication
  @Column({ name: 'two_factor_secret', type: 'text', nullable: true })
  twoFactorSecret?: string | null;

  @Column({ name: 'is_two_factor_enabled', type: 'boolean', default: false })
  isTwoFactorEnabled!: boolean;

  @Column({ name: 'two_factor_backup_codes', type: 'text', nullable: true })
  twoFactorBackupCodes?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}

