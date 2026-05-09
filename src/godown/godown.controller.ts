import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
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
  findAllInward() {
    return this.godownService.findAllInward();
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

  // Sales
  @Post('sales')
  @Permissions('godown', 'create')
  createSale(@Body() data: any) {
    return this.godownService.createSale(data);
  }

  @Get('sales')
  @Permissions('godown', 'read')
  findAllSales() {
    return this.godownService.findAllSales();
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
  findAllMortality() {
    return this.godownService.findAllMortality();
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
  findAllExpenses() {
    return this.godownService.findAllExpenses();
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
}
