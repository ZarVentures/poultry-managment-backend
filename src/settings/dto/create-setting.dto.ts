import { IsOptional, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSettingDto {
  @IsString()
  @Length(1, 100)
  key!: string;

  @Transform(({ value }) => (value === null || value === undefined ? '' : String(value)))
  @IsString()
  value!: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
