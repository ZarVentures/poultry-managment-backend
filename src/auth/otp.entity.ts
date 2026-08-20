import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'otp_sessions' })
export class OtpSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20 })
  phoneNumber!: string;

  @Column({ name: 'otp_hash', type: 'text' })
  otpHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'is_used', type: 'boolean', default: false })
  isUsed!: boolean;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'last_requested_at', type: 'timestamptz', default: () => 'NOW()' })
  lastRequestedAt!: Date;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
