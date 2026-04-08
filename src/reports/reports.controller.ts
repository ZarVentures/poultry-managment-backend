import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('purchases')
  async getPurchaseReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getPurchaseReport(startDate, endDate);
  }

  @Get('sales')
  async getSalesReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSalesReport(startDate, endDate);
  }

  @Get('mortality')
  async getMortalityReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getMortalityReport(startDate, endDate);
  }

  @Get('profit-loss')
  async getProfitLossReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getProfitLossReport(startDate, endDate);
  }

  @Get('gross-profit')
  async getGrossProfitReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getGrossProfitReport(startDate, endDate);
  }

  @Get('expense-breakdown')
  async getExpenseBreakdown(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getExpenseBreakdown(startDate, endDate);
  }

  @Get('batch-wise-profit')
  async getBatchWiseProfit(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getBatchWiseProfit(startDate, endDate);
  }

  @Get('farm-wise-profit')
  async getFarmWiseProfit(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getFarmWiseProfit(startDate, endDate);
  }

  @Get('customer-wise-sales')
  async getCustomerWiseSales(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getCustomerWiseSales(startDate, endDate);
  }
}
