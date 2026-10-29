import { IsEmail, IsNotEmpty, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class ForgotPhonePasswordDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+91[6-9]\d{9}$/, { message: 'Phone number must be a valid Indian number starting with +91' })
  phoneNumber!: string;
}

export class ResetPhonePasswordDto extends ForgotPhonePasswordDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;
}

export class ForgotEmailPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

export class ResetEmailPasswordDto extends ForgotEmailPasswordDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;
}
