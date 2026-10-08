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

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  phone?: string | null;

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

  // Self-service deletion. Null deletedAt means the account is not deleted.
  // status stays active|inactive so admin "activate" cannot skip OTP recovery.
  @Column({ name: 'deletion_requested_at', type: 'timestamptz', nullable: true })
  deletionRequestedAt?: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @Column({ name: 'deleted_by', type: 'bigint', nullable: true })
  deletedBy?: string | null;

  @Column({ name: 'deletion_reason', type: 'text', nullable: true })
  deletionReason?: string | null;

  @Column({ name: 'recovery_expires_at', type: 'timestamptz', nullable: true })
  recoveryExpiresAt?: Date | null;

  @Column({ name: 'status_before_deletion', type: 'varchar', length: 20, nullable: true })
  @Exclude()
  statusBeforeDeletion?: string | null;

  @Column({ name: 'purged_at', type: 'timestamptz', nullable: true })
  purgedAt?: Date | null;

  @Column({ name: 'purged_phone_hash', type: 'text', nullable: true })
  @Exclude()
  purgedPhoneHash?: string | null;

  @Column({ name: 'purged_email_hash', type: 'text', nullable: true })
  @Exclude()
  purgedEmailHash?: string | null;

  @Column({ name: 'recovery_nonce', type: 'text', nullable: true })
  @Exclude()
  recoveryNonce?: string | null;
}

