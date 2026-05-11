import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ExpenseCategoryType, PaymentMethodType } from '../expense.entity';

export class CreateExpenseDto {
  @IsDateString()
  expenseDate!: string;

  @IsOptional()
  @IsString()
  expenseOwner?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  // Legacy field for backward compatibility
  @IsOptional()
  @IsEnum(['feed', 'labor', 'medicine', 'utilities', 'equipment', 'maintenance', 'transportation', 'other'])
  category?: ExpenseCategoryType;

  @IsString()
  description!: string;

  @IsString()
  amount!: string; // Using string to handle decimal input

  @IsEnum(['cash', 'bank_transfer', 'check', 'credit_card'])
  paymentMethod!: PaymentMethodType;

  @IsOptional()
  @IsString()
  notes?: string;
}