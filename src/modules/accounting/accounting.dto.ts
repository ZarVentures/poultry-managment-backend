import { IsString, IsNotEmpty, IsNumber, IsEnum, IsOptional, Min, IsDateString } from 'class-validator';
import { TRANSACTION_TYPES, PAYMENT_METHODS, TransactionType, PaymentMethod, DEFAULT_SOURCE } from './accounting.constants';

export class AccountingTransactionDTO {
  @IsString()
  @IsNotEmpty()
  transactionId!: string;

  @IsEnum(TRANSACTION_TYPES)
  @IsNotEmpty()
  transactionType!: TransactionType;

  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount!: number;

  @IsString()
  @IsNotEmpty()
  partyName!: string;

  @IsEnum(PAYMENT_METHODS)
  @IsNotEmpty()
  paymentMethod!: PaymentMethod;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  entryDate?: string;

  @IsString()
  @IsOptional()
  externalRef?: string;

  @IsString()
  @IsOptional()
  source?: string = DEFAULT_SOURCE;
}
