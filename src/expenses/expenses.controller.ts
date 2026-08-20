import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { AccountingService } from '../modules/accounting/accounting.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly accountingService: AccountingService,
  ) {}

  @Get('sync-all')
  async syncAll() {
    try {
      const items = await this.expensesService.findAll();
      const synced: string[] = [];
      const failed: string[] = [];
      for (const item of items) {
        try {
          await this.accountingService.syncExpense(item);
          synced.push(item.id);
        } catch { failed.push(item.id); }
      }
      return { synced: synced.length, failed: failed.length, details: { synced, failed } };
    } catch (err: any) {
      return { synced: 0, failed: 0, error: err.message };
    }
  }

  @Post()
  create(@Body() createExpenseDto: CreateExpenseDto) {
    return this.expensesService.create(createExpenseDto);
  }

  @Get()
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('category') category?: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    return this.expensesService.findAll(startDate, endDate, category, paymentMethod);
  }

  @Get('by-category')
  getExpensesByCategory(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.expensesService.getExpensesByCategory(startDate, endDate);
  }

  @Get('total')
  getTotalExpenses(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.expensesService.getTotalExpenses(startDate, endDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateExpenseDto: UpdateExpenseDto) {
    return this.expensesService.update(id, updateExpenseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.expensesService.remove(id);
  }
}