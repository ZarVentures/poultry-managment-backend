import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  getDashboardKPIs(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getDashboardKPIs(startDate, endDate);
  }

  @Get('revenue-by-product')
  getRevenueByProductType(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getRevenueByProductType(startDate, endDate);
  }

  @Get('expenses-by-category')
  getExpensesByCategory(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getExpensesByCategory(startDate, endDate);
  }

  @Get('recent-sales')
  getRecentSales(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getRecentSales(limitNum);
  }

  @Get('recent-expenses')
  getRecentExpenses(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getRecentExpenses(limitNum);
  }

  // Advanced Analytics Endpoints

  @Get('monthly-revenue-vs-expenses')
  getMonthlyRevenueVsExpenses(@Query('months') months?: string) {
    const monthsNum = months ? parseInt(months, 10) : 6;
    return this.dashboardService.getMonthlyRevenueVsExpenses(monthsNum);
  }

  @Get('monthly-profit-trends')
  getMonthlyProfitTrends(@Query('months') months?: string) {
    const monthsNum = months ? parseInt(months, 10) : 6;
    return this.dashboardService.getMonthlyProfitTrends(monthsNum);
  }

  @Get('financial-summary')
  getFinancialSummary(@Query('months') months?: string) {
    const monthsNum = months ? parseInt(months, 10) : 6;
    return this.dashboardService.getFinancialSummary(monthsNum);
  }

  @Get('sales-performance')
  getSalesPerformanceByProduct(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getSalesPerformanceByProduct(startDate, endDate);
  }

  @Get('top-expense-categories')
  getTopExpenseCategories(
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.dashboardService.getTopExpenseCategories(limitNum, startDate, endDate);
  }

  @Get('inventory-summary')
  getInventorySummary() {
    return this.dashboardService.getInventorySummary();
  }

  @Get('purchases-summary')
  getPurchaseOrdersSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getPurchaseOrdersSummary(startDate, endDate);
  }

  @Get('comprehensive')
  getComprehensiveDashboard(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getComprehensiveDashboard(startDate, endDate);
  }
}