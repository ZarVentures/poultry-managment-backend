import { IsString, IsOptional, IsDateString, IsArray, ValidateNested, MaxLength, IsEnum, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseStatus, PurchasePaymentStatus } from '../entities/purchase-order.entity';

export class CreatePurchaseOrderItemDto {
  @IsString()
  description!: string;

  @IsString()
  quantity!: string;

  @IsString()
  @MaxLength(20)
  unit!: string;

  @IsString()
  unitCost!: string;
}

export class CreatePurchaseOrderCageDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cageId?: string;

  @IsNumber()
  numberOfBirds!: number;

  @IsNumber()
  cageWeight!: number;
}

export class CreatePurchaseOrderPaymentDto {
  @IsString()
  paymentMode!: string;

  @IsString()
  amount!: string;

  @IsOptional()
  isAdvance?: boolean;
}

export class CreatePurchaseOrderDto {
  @IsString()
  @MaxLength(50)
  orderNumber!: string;

  @IsString()
  @MaxLength(150)
  supplierName!: string;

  @IsDateString()
  orderDate!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(['pending', 'received', 'cancelled'])
  status?: PurchaseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  branch?: string;

  // Farmer integration
  @IsOptional()
  @IsString()
  farmerId?: string;

  @IsOptional()
  @IsString()
  farmerMobile?: string;

  @IsOptional()
  @IsString()
  farmLocation?: string;

  // Vehicle integration
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  totalWeight?: string;

  @IsOptional()
  @IsString()
  ratePerKg?: string;

  @IsOptional()
  @IsString()
  transportCharges?: string;

  @IsOptional()
  @IsString()
  otherCharges?: string;

  @IsOptional()
  @IsEnum(['paid', 'pending', 'partial'])
  purchasePaymentStatus?: PurchasePaymentStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  invoiceAttachment?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items?: CreatePurchaseOrderItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderCageDto)
  cages?: CreatePurchaseOrderCageDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderPaymentDto)
  payments?: CreatePurchaseOrderPaymentDto[];
}
