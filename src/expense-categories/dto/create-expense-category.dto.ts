import { IsString, IsOptional, IsBoolean, MaxLength, IsIn } from 'class-validator';

export class CreateExpenseCategoryDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['main', 'godown', 'both'])
  appliesTo?: 'main' | 'godown' | 'both';
}
