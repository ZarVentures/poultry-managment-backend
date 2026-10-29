import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SetPasswordDto {
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(72)
  currentPassword?: string;
}
