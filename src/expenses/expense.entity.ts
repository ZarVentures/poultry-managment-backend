import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ExpenseCategory } from '../expense-categories/expense-category.entity';

export type ExpenseCategoryType = 'feed' | 'labor' | 'medicine' | 'utilities' | 'equipment' | 'maintenance' | 'transportation' | 'other';
export type PaymentMethodType = 'cash' | 'bank_transfer' | 'check' | 'credit_card';

@Entity({ name: 'expenses' })
export class Expense {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'expense_date', type: 'date' })
  expenseDate!: string;

  @Column({ name: 'expense_owner', type: 'varchar', length: 150, nullable: true })
  expenseOwner?: string;

  // Legacy category field (kept for backward compatibility)
  @Column({
    type: 'enum',
    enum: ['feed', 'labor', 'medicine', 'utilities', 'equipment', 'maintenance', 'transportation', 'other'],
    enumName: 'expense_category_type',
    nullable: true,
  })
  category?: ExpenseCategoryType;

  // New category relationship
  @Column({ name: 'category_id', type: 'bigint', nullable: true, insert: false, update: false })
  categoryId?: string;

  @ManyToOne(() => ExpenseCategory, (category) => category.expenses, { eager: true })
  @JoinColumn({ name: 'category_id' })
  expenseCategory?: ExpenseCategory;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount!: number;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: ['cash', 'bank_transfer', 'check', 'credit_card'],
    enumName: 'payment_method_type',
  })
  paymentMethod!: PaymentMethodType;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}