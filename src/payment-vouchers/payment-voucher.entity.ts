import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('payment_vouchers')
export class PaymentVoucher {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'voucher_number', unique: true, length: 50 })
  voucherNumber: string;

  @Column({ name: 'voucher_date', type: 'date' })
  voucherDate: Date;

  @Column({ name: 'payee_type', length: 20 })
  payeeType: 'farmer' | 'retailer' | 'supplier' | 'employee' | 'other';

  @Column({ name: 'payee_id', nullable: true })
  payeeId: number;

  @Column({ name: 'payee_name', length: 255 })
  payeeName: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'payment_method', length: 20 })
  paymentMethod: 'cash' | 'cheque' | 'bank_transfer' | 'upi' | 'card';

  @Column({ name: 'cheque_number', length: 50, nullable: true })
  chequeNumber: string;

  @Column({ name: 'bank_name', length: 100, nullable: true })
  bankName: string;

  @Column({ name: 'transaction_reference', length: 100, nullable: true })
  transactionReference: string;

  @Column({ length: 255 })
  purpose: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'reference_type', length: 20, nullable: true })
  referenceType: 'purchase' | 'expense' | 'sale' | 'other';

  @Column({ name: 'reference_id', nullable: true })
  referenceId: number;

  @Column({ length: 20, default: 'pending' })
  status: 'pending' | 'paid' | 'cancelled';

  @Column({ name: 'paid_date', type: 'date', nullable: true })
  paidDate: Date;

  @Column({ name: 'attachment_url', length: 500, nullable: true })
  attachmentUrl: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'created_by', nullable: true })
  createdById: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedBy: User;

  @Column({ name: 'approved_by', nullable: true })
  approvedById: number;

  @Column({ name: 'approved_date', type: 'timestamp', nullable: true })
  approvedDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
