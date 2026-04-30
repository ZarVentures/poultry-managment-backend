import { IsString, IsOptional, IsDateString, IsEnum, MaxLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SaleProductType, PaymentStatusType, SaleModeType } from '../sale.entity';

export class CreateSalePaymentDto {
  @IsString()
  paymentMode!: string;

  @IsString()
  amount!: string;
}

export class CreateSaleDto {
  @IsString()
  @MaxLength(50)
  invoiceNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  saleNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  purchaseBillNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cageNo?: string;

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
  quantity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsString()
  unitPrice?: string;

  @IsOptional()
  @IsEnum(['paid', 'pending', 'partial'])
  paymentStatus?: PaymentStatusType;

  @IsOptional()
  @IsString()
  amountReceived?: string;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalePaymentDto)
  payments?: CreateSalePaymentDto[];

  // Extra fields from frontend (not stored directly)
  @IsOptional()
  totalBirds?: number;

  @IsOptional()
  totalWeight?: number;

  @IsOptional()
  customerRows?: any[];
}
