import { IsNotEmpty, IsString, IsNumber, IsEnum, IsOptional, IsDateString, Min } from 'class-validator';

export class CreatePaymentVoucherDto {
  @IsNotEmpty()
  @IsDateString()
  voucherDate: string;

  @IsNotEmpty()
  @IsEnum(['farmer', 'retailer', 'supplier', 'employee', 'other'])
  payeeType: 'farmer' | 'retailer' | 'supplier' | 'employee' | 'other';

  @IsOptional()
  @IsNumber()
  payeeId?: number;

  @IsNotEmpty()
  @IsString()
  payeeName: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;

  @IsNotEmpty()
  @IsEnum(['cash', 'cheque', 'bank_transfer', 'upi', 'card'])
  paymentMethod: 'cash' | 'cheque' | 'bank_transfer' | 'upi' | 'card';

  @IsOptional()
  @IsString()
  chequeNumber?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  transactionReference?: string;

  @IsNotEmpty()
  @IsString()
  purpose: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['purchase', 'expense', 'sale', 'other'])
  referenceType?: 'purchase' | 'expense' | 'sale' | 'other';

  @IsOptional()
  @IsNumber()
  referenceId?: number;

  @IsOptional()
  @IsEnum(['pending', 'paid', 'cancelled'])
  status?: 'pending' | 'paid' | 'cancelled';

  @IsOptional()
  @IsDateString()
  paidDate?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
