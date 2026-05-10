import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentVouchersService } from './payment-vouchers.service';
import { CreatePaymentVoucherDto } from './dto/create-payment-voucher.dto';
import { UpdatePaymentVoucherDto } from './dto/update-payment-voucher.dto';

@Controller('payment-vouchers')
@UseGuards(JwtAuthGuard)
export class PaymentVouchersController {
  constructor(private readonly paymentVouchersService: PaymentVouchersService) {}

  @Post()
  create(@Body() createDto: CreatePaymentVoucherDto, @Request() req) {
    return this.paymentVouchersService.create(createDto, req.user.userId);
  }

  @Get()
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('payeeType') payeeType?: string,
  ) {
    return this.paymentVouchersService.findAll({ startDate, endDate, status, payeeType });
  }

  @Get('stats')
  getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.paymentVouchersService.getStats(startDate, endDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentVouchersService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdatePaymentVoucherDto) {
    return this.paymentVouchersService.update(+id, updateDto);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Request() req) {
    return this.paymentVouchersService.approve(+id, req.user.userId);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.paymentVouchersService.cancel(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paymentVouchersService.remove(+id);
  }
}
