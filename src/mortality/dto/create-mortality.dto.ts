import { IsString, IsOptional, IsDateString, IsInt, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMortalityDto {
  @IsString()
  purchaseInvoiceNo!: string;

  @IsDateString()
  purchaseDate!: string;

  @IsString()
  farmerName!: string;

  @IsOptional()
  @IsString()
  farmLocation?: string;

  @IsOptional()
  @IsString()
  cageIdNumber?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalBirdsPurchased!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  numberOfBirdsDied!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weightOfDeadBirds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ratePerKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @IsString()
  cause!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
