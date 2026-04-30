import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, Length } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  vehicleNumber!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  vehicleType!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  driverName!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsOptional()
  @IsString()
  @Length(0, 150)
  ownerName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  totalCapacity?: string;

  @IsOptional()
  @IsString()
  petrolTankCapacity?: string;

  @IsOptional()
  @IsString()
  fuelType?: string;

  @IsOptional()
  @IsString()
  mileage?: string;

  @IsDateString()
  joinDate!: string;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsString()
  note?: string;
}

