import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity({ name: 'communication_logs' })
export class CommunicationLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  recipient!: string;

  @Column({ type: 'varchar', length: 20 })
  channel!: 'email' | 'sms';

  @Column({ type: 'varchar', length: 50 })
  messageType!: string; // 'sales_invoice' | 'low_inventory' | 'critical_loss' | 'daily_mortality' | 'test'

  @Column({ type: 'text', nullable: true })
  contentPreview?: string;

  @Column({ type: 'varchar', length: 20 })
  status!: 'sent' | 'failed';

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ name: 'sent_at', type: 'timestamptz' })
  sentAt!: Date;
}
