import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) { }

  async create(createExpenseDto: CreateExpenseDto): Promise<Expense> {
    const expense = this.expenseRepository.create({
      ...createExpenseDto,
      amount: parseFloat(createExpenseDto.amount),
    });
    return this.expenseRepository.save(expense);
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
    expense.updatedAt = new Date();
    return this.expenseRepository.save(expense);
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