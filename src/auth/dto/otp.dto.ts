import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+91[6-9]\d{9}$/, { message: 'Phone number must be a valid Indian number starting with +91' })
  phoneNumber!: string;
}

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+91[6-9]\d{9}$/, { message: 'Phone number must be a valid Indian number starting with +91' })
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp!: string;
}

export class RegisterSendOtpDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+91[6-9]\d{9}$/, { message: 'Phone number must be a valid Indian number starting with +91' })
  phoneNumber!: string;
}

export class RegisterVerifyOtpDto extends RegisterSendOtpDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp!: string;
}
