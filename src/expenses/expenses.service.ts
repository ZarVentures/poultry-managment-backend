import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { AccountingService } from '../modules/accounting/accounting.service';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly accountingService: AccountingService,
  ) { }

  async create(createExpenseDto: CreateExpenseDto): Promise<Expense> {
    const expense = this.expenseRepository.create({
      ...createExpenseDto,
      amount: parseFloat(createExpenseDto.amount),
      expenseCategory: createExpenseDto.categoryId ? { id: createExpenseDto.categoryId } as any : undefined,
    });
    const saved = await this.expenseRepository.save(expense);

    this.findOne(saved.id).then(fullExpense => {
      this.accountingService.syncExpense(fullExpense).catch((err) => {
        console.error('Failed to trigger accounting sync for expense:', err);
      });
    }).catch(err => {
      console.error('Failed to load full expense for sync:', err);
    });

    return saved;
  }

  async findAll(
    startDate?: string,
    endDate?: string,
    category?: string,
    paymentMethod?: string,
  ): Promise<Expense[]> {
    const query = this.expenseRepository.createQueryBuilder('expense')
      .leftJoinAndSelect('expense.expenseCategory', 'expenseCategory')
      .orderBy('expense.expenseDate', 'DESC');

    if (startDate && endDate) {
      query.andWhere('expense.expenseDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    if (category) {
      query.andWhere('expense.category = :category', { category });
    }

    if (paymentMethod) {
      query.andWhere('expense.paymentMethod = :paymentMethod', { paymentMethod });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<Expense> {
    const expense = await this.expenseRepository.findOne({
      where: { id },
      relations: ['expenseCategory']
    });
    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found`);
    }
    return expense;
  }

  async update(id: string, updateExpenseDto: UpdateExpenseDto): Promise<Expense> {
    const expense = await this.findOne(id);

    const updateData: any = {
      ...updateExpenseDto,
      amount: updateExpenseDto.amount ? parseFloat(updateExpenseDto.amount) : expense.amount,
      expenseCategory: updateExpenseDto.categoryId ? { id: updateExpenseDto.categoryId } : undefined,
    };

    Object.assign(expense, updateData);
    expense.updatedAt = new Date();
    const saved = await this.expenseRepository.save(expense);

    this.findOne(saved.id).then(fullExpense => {
      this.accountingService.syncExpense(fullExpense).catch((err) => {
        console.error('Failed to trigger accounting sync for expense update:', err);
      });
    }).catch(err => {
      console.error('Failed to load full expense for sync update:', err);
    });

    return saved;
  }

  async remove(id: string): Promise<void> {
    const expense = await this.findOne(id);
    await this.expenseRepository.remove(expense);
  }

  async getExpensesByCategory(startDate?: string, endDate?: string): Promise<any[]> {
    const query = this.expenseRepository.createQueryBuilder('expense')
      .leftJoin('expense.expenseCategory', 'cat')
      .select('COALESCE(cat.name, expense.category)', 'category')
      .addSelect('SUM(expense.amount)', 'total')
      .groupBy('COALESCE(cat.name, expense.category)');

    if (startDate && endDate) {
      query.andWhere('expense.expenseDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    return query.getRawMany();
  }

  async getTotalExpenses(startDate?: string, endDate?: string): Promise<number> {
    const query = this.expenseRepository.createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'total');

    if (startDate && endDate) {
      query.andWhere('expense.expenseDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const result = await query.getRawOne();
    return parseFloat(result.total) || 0;
  }
}