import { IsString, IsNotEmpty, IsNumber, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export class CreateBirdReturnDto {
  @IsString()
  @IsNotEmpty()
  returnDate!: string;

  @IsString()
  @IsNotEmpty()
  saleId!: string;

  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsString()
  @IsOptional()
  retailerId?: string;

  @IsNumber()
  @IsNotEmpty()
  numberOfBirdsReturned!: number;

  @IsString()
  @IsOptional()
  weightReturned?: string;

  @IsEnum(['sick', 'underweight', 'quality_issue', 'customer_request', 'other', 'dead'])
  @IsNotEmpty()
  returnReason!: 'sick' | 'underweight' | 'quality_issue' | 'customer_request' | 'other' | 'dead';

  @IsString()
  @IsOptional()
  reasonDescription?: string;

  @IsString()
  @IsOptional()
  refundAmount?: string;

  @IsString()
  @IsOptional()
  adjustmentAmount?: string;

  @IsEnum(['pending', 'approved', 'rejected', 'processed'])
  @IsOptional()
  status?: 'pending' | 'approved' | 'rejected' | 'processed';

  @IsBoolean()
  @IsOptional()
  returnedToInventory?: boolean;

  @IsString()
  @IsOptional()
  inventoryLocation?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
