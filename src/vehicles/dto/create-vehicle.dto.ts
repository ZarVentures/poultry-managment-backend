import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

const optionalString = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value);
};

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
  @Transform(optionalString)
  @IsString()
  totalCapacity?: string;

  @IsOptional()
  @Transform(optionalString)
  @IsString()
  petrolTankCapacity?: string;

  @IsOptional()
  @IsString()
  fuelType?: string;

  @IsOptional()
  @Transform(optionalString)
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

