import { IsString, IsOptional, IsDateString, IsArray, ValidateNested, MaxLength, IsEnum, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseStatus, PurchasePaymentStatus } from '../entities/purchase-order.entity';

export class CreatePurchaseOrderItemDto {
  @IsString()
  description!: string;

  @IsString()
  quantity!: string; // Using string to handle decimal input

  @IsString()
  @MaxLength(20)
  unit!: string;

  @IsString()
  unitCost!: string; // Using string to handle decimal input
}

export class CreatePurchaseOrderCageDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  birdType?: string;

  @IsNumber()
  numberOfBirds!: number;

  @IsNumber()
  cageWeight!: number;
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

  // Invoice header fields
  @IsOptional()
  @IsString()
  @MaxLength(100)
  branch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gstin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  liftingTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  partyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  prNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  hsnCode?: string;

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

  // Bird details
  @IsOptional()
  @IsString()
  birdType?: string;

  @IsOptional()
  @IsString()
  totalWeight?: string;

  @IsOptional()
  @IsString()
  ratePerKg?: string;

  @IsOptional()
  @IsString()
  notes?: string;

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

  // Payment tracking
  @IsOptional()
  @IsEnum(['paid', 'pending', 'partial'])
  purchasePaymentStatus?: PurchasePaymentStatus;

  @IsOptional()
  @IsString()
  advancePaid?: string;

  @IsOptional()
  @IsString()
  paymentMode?: string;

  @IsOptional()
  @IsString()
  totalPaymentMade?: string;

  @IsOptional()
  @IsString()
  invoiceAttachment?: string;

  @IsOptional()
  @IsArray()
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
}