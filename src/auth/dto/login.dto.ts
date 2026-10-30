import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class PhonePasswordLoginDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+91[6-9]\d{9}$/, { message: 'Phone number must be a valid Indian number starting with +91' })
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

