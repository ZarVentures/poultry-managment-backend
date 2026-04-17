import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { GodownService } from './godown.service';

@Controller('godown')
export class GodownController {
  constructor(private readonly godownService: GodownService) {}

  // Inward Entries
  @Post('inward')
  createInward(@Body() data: any) {
    return this.godownService.createInward(data);
  }

  @Get('inward')
  findAllInward() {
    return this.godownService.findAllInward();
  }

  @Get('inward/:id')
  findOneInward(@Param('id') id: string) {
    return this.godownService.findOneInward(id);
  }

  @Patch('inward/:id')
  updateInward(@Param('id') id: string, @Body() data: any) {
    return this.godownService.updateInward(id, data);
  }

  @Delete('inward/:id')
  removeInward(@Param('id') id: string) {
    return this.godownService.removeInward(id);
  }

  // Sales
  @Post('sales')
  createSale(@Body() data: any) {
    return this.godownService.createSale(data);
  }

  @Get('sales')
  findAllSales() {
    return this.godownService.findAllSales();
  }

  @Get('sales/:id')
  findOneSale(@Param('id') id: string) {
    return this.godownService.findOneSale(id);
  }

  @Patch('sales/:id')
  updateSale(@Param('id') id: string, @Body() data: any) {
    return this.godownService.updateSale(id, data);
  }

  @Delete('sales/:id')
  removeSale(@Param('id') id: string) {
    return this.godownService.removeSale(id);
  }

  // Mortality
  @Post('mortality')
  createMortality(@Body() data: any) {
    return this.godownService.createMortality(data);
  }

  @Get('mortality')
  findAllMortality() {
    return this.godownService.findAllMortality();
  }

  @Get('mortality/:id')
  findOneMortality(@Param('id') id: string) {
    return this.godownService.findOneMortality(id);
  }

  @Patch('mortality/:id')
  updateMortality(@Param('id') id: string, @Body() data: any) {
    return this.godownService.updateMortality(id, data);
  }

  @Delete('mortality/:id')
  removeMortality(@Param('id') id: string) {
    return this.godownService.removeMortality(id);
  }

  // Expenses
  @Post('expenses')
  createExpense(@Body() data: any) {
    return this.godownService.createExpense(data);
  }

  @Get('expenses')
  findAllExpenses() {
    return this.godownService.findAllExpenses();
  }

  @Get('expenses/:id')
  findOneExpense(@Param('id') id: string) {
    return this.godownService.findOneExpense(id);
  }

  @Patch('expenses/:id')
  updateExpense(@Param('id') id: string, @Body() data: any) {
    return this.godownService.updateExpense(id, data);
  }

  @Delete('expenses/:id')
  removeExpense(@Param('id') id: string) {
    return this.godownService.removeExpense(id);
  }

  // Summary
  @Get('summary')
  getSummary() {
    return this.godownService.getSummary();
  }
}
