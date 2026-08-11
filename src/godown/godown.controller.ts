import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { GodownService } from './godown.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('godown')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GodownController {
  constructor(private readonly godownService: GodownService) { }

  // Inward Entries
  @Post('inward')
  @Permissions('godown', 'create')
  createInward(@Body() data: any) {
    return this.godownService.createInward(data);
  }

  @Get('inward')
  @Permissions('godown', 'read')
  findAllInward(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.godownService.findAllInward(page, limit, search);
  }

  @Get('inward/:id')
  @Permissions('godown', 'read')
  findOneInward(@Param('id') id: string) {
    return this.godownService.findOneInward(id);
  }

  @Patch('inward/:id')
  @Permissions('godown', 'update')
  updateInward(@Param('id') id: string, @Body() data: any) {
    return this.godownService.updateInward(id, data);
  }

  @Delete('inward/:id')
  @Permissions('godown', 'delete')
  removeInward(@Param('id') id: string) {
    return this.godownService.removeInward(id);
  }

  // Inward Auto Number
  @Get('inward/generate/next-inward-number')
  @Permissions('godown', 'read')
  async getNextInwardNumber() {
    const nextInwardNumber = await this.godownService.generateNextInwardNumber();
    return { nextInwardNumber };
  }

  // Sales
  @Get('sales/generate/next-sale-number')
  @Permissions('godown', 'read')
  async getNextSaleNumber() {
    const nextSaleNumber = await this.godownService.generateNextSaleNumber();
    return { nextSaleNumber };
  }

  @Post('sales')
  @Permissions('godown', 'create')
  createSale(@Body() data: any) {
    return this.godownService.createSale(data);
  }

  @Get('sales')
  @Permissions('godown', 'read')
  findAllSales(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.godownService.findAllSales(page, limit, search);
  }

  @Get('sales/:id')
  @Permissions('godown', 'read')
  findOneSale(@Param('id') id: string) {
    return this.godownService.findOneSale(id);
  }

  @Patch('sales/:id')
  @Permissions('godown', 'update')
  updateSale(@Param('id') id: string, @Body() data: any) {
    return this.godownService.updateSale(id, data);
  }

  @Delete('sales/:id')
  @Permissions('godown', 'delete')
  removeSale(@Param('id') id: string) {
    return this.godownService.removeSale(id);
  }

  // Mortality
  @Post('mortality')
  @Permissions('godown', 'create')
  createMortality(@Body() data: any) {
    return this.godownService.createMortality(data);
  }

  @Get('mortality')
  @Permissions('godown', 'read')
  findAllMortality(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.godownService.findAllMortality(page, limit, search);
  }

  @Get('mortality/:id')
  @Permissions('godown', 'read')
  findOneMortality(@Param('id') id: string) {
    return this.godownService.findOneMortality(id);
  }

  @Patch('mortality/:id')
  @Permissions('godown', 'update')
  updateMortality(@Param('id') id: string, @Body() data: any) {
    return this.godownService.updateMortality(id, data);
  }

  @Delete('mortality/:id')
  @Permissions('godown', 'delete')
  removeMortality(@Param('id') id: string) {
    return this.godownService.removeMortality(id);
  }

  // Expenses
  @Post('expenses')
  @Permissions('godown', 'create')
  createExpense(@Body() data: any) {
    return this.godownService.createExpense(data);
  }

  @Get('expenses')
  @Permissions('godown', 'read')
  findAllExpenses(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.godownService.findAllExpenses(page, limit, search, startDate, endDate);
  }

  @Get('expenses/:id')
  @Permissions('godown', 'read')
  findOneExpense(@Param('id') id: string) {
    return this.godownService.findOneExpense(id);
  }

  @Patch('expenses/:id')
  @Permissions('godown', 'update')
  updateExpense(@Param('id') id: string, @Body() data: any) {
    return this.godownService.updateExpense(id, data);
  }

  @Delete('expenses/:id')
  @Permissions('godown', 'delete')
  removeExpense(@Param('id') id: string) {
    return this.godownService.removeExpense(id);
  }

  // Summary
  @Get('summary')
  @Permissions('godown', 'read')
  getSummary() {
    return this.godownService.getSummary();
  }

  // Stock Ledger — chronological bird/weight movements with running balance
  @Get('stock-ledger')
  @Permissions('godown', 'read')
  getStockLedger(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    return this.godownService.getStockLedger({ startDate, endDate, type, search });
  }
}
