import { IsString, IsOptional, IsDateString, IsInt, Min } from 'class-validator';

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

  @IsInt()
  @Min(0)
  totalBirdsPurchased!: number;

  @IsInt()
  @Min(1)
  numberOfBirdsDied!: number;

  @IsOptional()
  weightOfDeadBirds?: number;

  @IsString()
  cause!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
