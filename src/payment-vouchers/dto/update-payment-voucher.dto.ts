import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentVoucherDto } from './create-payment-voucher.dto';
import { IsOptional, IsEnum } from 'class-validator';

export class UpdatePaymentVoucherDto extends PartialType(CreatePaymentVoucherDto) {
  // Make voucherType optional for updates
  @IsOptional()
  @IsEnum(['in', 'out'])
  voucherType?: 'in' | 'out';
}
