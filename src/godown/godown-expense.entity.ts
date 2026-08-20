import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('godown_expenses')
export class GodownExpense {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'expense_date', type: 'date' })
  expenseDate!: string;

  @Column({ name: 'category', type: 'varchar', length: 100 })
  category!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount!: number;

  @Column({ name: 'payment_method', type: 'enum', enum: ['cash', 'bank_transfer', 'check', 'credit_card'] })
  paymentMethod!: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true })
  tenantId?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
