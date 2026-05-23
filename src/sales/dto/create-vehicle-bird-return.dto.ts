import { IsString, IsNotEmpty, IsNumber, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export class CreateVehicleBirdReturnDto {
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

  @IsEnum(['dead', 'sick', 'underweight', 'quality_issue', 'customer_request', 'other'])
  @IsNotEmpty()
  returnReason!: 'dead' | 'sick' | 'underweight' | 'quality_issue' | 'customer_request' | 'other';

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
