import { IsString, IsOptional, IsEmail, MaxLength, IsEnum, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFarmerDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsString()
  @MaxLength(50)
  phone!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  farmhouseName?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  openingBalance?: number;
}