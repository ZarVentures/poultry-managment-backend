import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ReportsService } from './reports.service';
import { BalanceSheetService } from './balance-sheet.service';
import { BalanceSheetQueryDto } from './dto/balance-sheet-query.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly balanceSheetService: BalanceSheetService,
  ) { }

  @Get('purchases')
  @Permissions('reports', 'read')
  async getPurchaseReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getPurchaseReport(startDate, endDate);
  }

  @Get('sales')
  @Permissions('reports', 'read')
  async getSalesReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSalesReport(startDate, endDate);
  }

  @Get('mortality')
  @Permissions('reports', 'read')
  async getMortalityReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getMortalityReport(startDate, endDate);
  }

  @Get('profit-loss')
  @Permissions('reports', 'read')
  async getProfitLossReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getProfitLossReport(startDate, endDate);
  }

  @Get('gross-profit')
  @Permissions('reports', 'read')
  async getGrossProfitReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getGrossProfitReport(startDate, endDate);
  }

  @Get('expense-breakdown')
  @Permissions('reports', 'read')
  async getExpenseBreakdown(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getExpenseBreakdown(startDate, endDate);
  }

  @Get('batch-wise-profit')
  @Permissions('reports', 'read')
  async getBatchWiseProfit(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getBatchWiseProfit(startDate, endDate);
  }

  @Get('farm-wise-profit')
  @Permissions('reports', 'read')
  async getFarmWiseProfit(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getFarmWiseProfit(startDate, endDate);
  }

  @Get('customer-wise-sales')
  @Permissions('reports', 'read')
  async getCustomerWiseSales(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getCustomerWiseSales(startDate, endDate);
  }

  @Get('outstanding')
  @Permissions('reports', 'read')
  async getOutstandingReport(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
  ) {
    return this.reportsService.getOutstandingReport(page, limit, sortBy);
  }

  @Get('collection')
  @Permissions('reports', 'read')
  async getCollectionReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('mode') mode?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reportsService.getCollectionReport({ startDate, endDate, mode, page, limit });
  }

  @Get('godown-sales')
  @Permissions('reports', 'read')
  async getGodownSalesReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getGodownSalesReport(startDate, endDate);
  }

  @Get('godown-inward')
  @Permissions('reports', 'read')
  async getGodownInwardReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getGodownInwardReport(startDate, endDate);
  }

  @Get('weight-loss')
  @Permissions('reports', 'read')
  async getWeightLossReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getWeightLossReport(startDate, endDate);
  }

  @Get('balance-sheet')
  @Permissions('billing', 'read')
  async getBalanceSheet(@Query() query: BalanceSheetQueryDto) {
    return this.balanceSheetService.getBalanceSheet(query.asOnDate);
  }
}
