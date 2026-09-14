import { PartialType } from '@nestjs/mapped-types';
import { Allow, IsDateString, IsOptional } from 'class-validator';
import { CreateFarmerDto } from './create-farmer.dto';

export class UpdateFarmerDto extends PartialType(CreateFarmerDto) {
  @Allow()
  @IsOptional()
  @IsDateString()
  joinDate?: string;
}
