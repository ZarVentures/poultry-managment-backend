import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentVouchersService } from './payment-vouchers.service';
import { CreatePaymentVoucherDto } from './dto/create-payment-voucher.dto';
import { UpdatePaymentVoucherDto } from './dto/update-payment-voucher.dto';
import { AccountingService } from '../modules/accounting/accounting.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('payment-vouchers')
@UseGuards(JwtAuthGuard)
export class PaymentVouchersController {
  constructor(
    private readonly paymentVouchersService: PaymentVouchersService,
    private readonly accountingService: AccountingService,
  ) {}

  @Public()
  @Get('sync-all')
  async syncAll() {
    try {
      const items = await this.paymentVouchersService.findAll({});
      const synced: string[] = [];
      const failed: string[] = [];
      for (const item of items) {
        try {
          await this.accountingService.syncPayment(item);
          synced.push(String(item.id));
        } catch { failed.push(String(item.id)); }
      }
      return { synced: synced.length, failed: failed.length, details: { synced, failed } };
    } catch (err: any) {
      return { synced: 0, failed: 0, error: err.message };
    }
  }

  @Post()
  create(@Body() createDto: CreatePaymentVoucherDto, @Request() req: any) {
    return this.paymentVouchersService.create(createDto, req.user.userId);
  }

  @Get()
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('payeeType') payeeType?: string,
    @Query('voucherType') voucherType?: string,
  ) {
    return this.paymentVouchersService.findAll({ startDate, endDate, status, payeeType, voucherType });
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
  approve(@Param('id') id: string, @Request() req: any) {
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
