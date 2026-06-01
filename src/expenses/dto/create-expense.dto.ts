import { IsDateString, IsOptional, IsString, IsEnum } from 'class-validator';
import { ExpenseCategoryType, PaymentMethodType } from '../expense.entity';

export class CreateExpenseDto {
  @IsDateString()
  expenseDate: string;

  @IsOptional()
  @IsString()
  expenseOwner?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(['feed', 'labor', 'medicine', 'utilities', 'equipment', 'maintenance', 'transportation', 'other'])
  category?: ExpenseCategoryType;

  @IsString()
  description: string;

  @IsString()
  amount: string;

  @IsEnum(['cash', 'bank_transfer', 'check', 'credit_card'])
  paymentMethod: PaymentMethodType;

  @IsOptional()
  @IsString()
  notes?: string;
}
