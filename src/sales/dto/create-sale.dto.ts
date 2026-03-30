import { IsString, IsOptional, IsDateString, IsEnum, MaxLength } from 'class-validator';
import { SaleProductType, PaymentStatusType, SaleModeType } from '../sale.entity';

export class CreateSaleDto {
  @IsString()
  @MaxLength(50)
  invoiceNumber!: string;

  @IsString()
  @MaxLength(150)
  customerName!: string;

  @IsDateString()
  saleDate!: string;

  @IsEnum(['from_vehicle', 'from_godown'])
  saleMode!: SaleModeType;

  @IsEnum(['eggs', 'meat', 'chicks', 'other'])
  productType!: SaleProductType;

  @IsOptional()
  @IsString()
  quantity?: string; // Using string to handle decimal input

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsString()
  unitPrice?: string; // Using string to handle decimal input

  @IsOptional()
  @IsEnum(['paid', 'pending', 'partial'])
  paymentStatus?: PaymentStatusType;

  @IsOptional()
  @IsString()
  amountReceived?: string; // Using string to handle decimal input

  @IsOptional()
  @IsString()
  transportCharges?: string;

  @IsOptional()
  @IsString()
  loadingCharges?: string;

  @IsOptional()
  @IsString()
  commission?: string;

  @IsOptional()
  @IsString()
  otherCharges?: string;

  @IsOptional()
  @IsString()
  weightShortage?: string;

  @IsOptional()
  @IsString()
  mortalityDeduction?: string;

  @IsOptional()
  @IsString()
  otherDeduction?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  retailerId?: string;
}