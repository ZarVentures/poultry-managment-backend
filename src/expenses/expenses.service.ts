import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './expense.entity';
import { ExpenseCategory } from '../expense-categories/expense-category.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { AccountingService } from '../modules/accounting/accounting.service';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(ExpenseCategory)
    private readonly categoryRepository: Repository<ExpenseCategory>,
    private readonly accountingService: AccountingService,
  ) { }

  async create(createExpenseDto: CreateExpenseDto): Promise<Expense> {
    // The legacy `category` column is NOT NULL in production DB.
    // When only categoryId is sent (new flow), we fall back to 'other' so the
    // constraint is never violated. The real category name comes from the relation.
    const legacyCategory = createExpenseDto.category || 'other';

    const expense = this.expenseRepository.create({
      ...createExpenseDto,
      category: legacyCategory as any,
      amount: parseFloat(createExpenseDto.amount),
    });
    // If a categoryId was provided, resolve and attach the category entity
    if (createExpenseDto.categoryId) {
      try {
        const cat = await this.categoryRepository.findOne({ where: { id: createExpenseDto.categoryId } });
        if (cat) expense.expenseCategory = cat;
      } catch (err) {
        // ignore - we'll still save without relation if lookup fails
      }
    }

    const saved = await this.expenseRepository.save(expense);
    const fullExpense = await this.findOne(saved.id);
    this.accountingService.syncExpense(fullExpense).catch((err) => {
      console.error('Failed to trigger accounting sync for expense:', err);
    });

    return fullExpense;
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

    const updateData = {
      ...updateExpenseDto,
      amount: updateExpenseDto.amount ? parseFloat(updateExpenseDto.amount) : expense.amount,
    };

    Object.assign(expense, updateData);
    if (updateExpenseDto.categoryId) {
      try {
        const cat = await this.categoryRepository.findOne({ where: { id: updateExpenseDto.categoryId } });
        expense.expenseCategory = cat || undefined;
      } catch (err) {
        // ignore lookup errors
      }
    }
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