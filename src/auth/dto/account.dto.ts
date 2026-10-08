import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  @Matches(/^DELETE$/, { message: 'Type DELETE to confirm' })
  confirmation!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;

  @IsOptional()
  @IsString()
  @Length(6, 6)
  otp?: string;

  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RecoverSendOtpDto {
  @IsOptional()
  @IsString()
  @Matches(/^\+91[6-9]\d{9}$/, { message: 'Phone number must be a valid Indian number starting with +91' })
  phoneNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class RecoverVerifyOtpDto {
  @IsOptional()
  @IsString()
  @Matches(/^\+91[6-9]\d{9}$/, { message: 'Phone number must be a valid Indian number starting with +91' })
  phoneNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp!: string;
}

export class RestoreAccountDto {
  @IsString()
  recoveryToken!: string;

  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;
}
