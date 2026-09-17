import { IsDateString, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentMethodType } from '../expense.entity';

function normalizePaymentMethod(value: unknown): string {
  const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  if (raw === 'cheque' || raw === 'cheque_payment') return 'check';
  if (raw === 'card' || raw === 'creditcard' || raw === 'credit-card') return 'credit_card';
  if (raw === 'bank' || raw === 'banktransfer' || raw === 'bank_transfer') return 'bank_transfer';
  if (raw === 'upi' || raw === 'gpay' || raw === 'phonepe' || raw === 'googlepay') return 'upi';
  if (raw === 'cash') return 'cash';
  return raw;
}

export class CreateExpenseDto {
  @IsDateString()
  expenseDate: string;

  @IsOptional()
  @IsString()
  expenseOwner?: string;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined || value === '' ? undefined : String(value)))
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsString()
  description: string;

  @Transform(({ value }) => String(value ?? ''))
  @IsString()
  amount: string;

  @Transform(({ value }) => normalizePaymentMethod(value))
  @IsString()
  paymentMethod: PaymentMethodType | string;

  @IsOptional()
  @IsString()
  notes?: string;
}
