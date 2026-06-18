import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseCategory } from './expense-category.entity';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

@Injectable()
export class ExpenseCategoriesService {
  constructor(
    @InjectRepository(ExpenseCategory)
    private readonly categoryRepo: Repository<ExpenseCategory>,
  ) {}

  async create(createDto: CreateExpenseCategoryDto): Promise<ExpenseCategory> {
    // Check if category name already exists
    const existing = await this.categoryRepo.findOne({
      where: { name: createDto.name },
    });

    if (existing) {
      throw new BadRequestException(`Category with name "${createDto.name}" already exists`);
    }

    const category = this.categoryRepo.create({
      ...createDto,
      isSystem: false, // User-created categories are never system categories
    });

    return this.categoryRepo.save(category);
  }

  async findActive(type?: string): Promise<ExpenseCategory[]> {
    if (type) {
      return this.categoryRepo.find({
        where: [
          { isActive: true, appliesTo: type as 'main' | 'godown' | 'both' },
          { isActive: true, appliesTo: 'both' },
        ],
        order: { sortOrder: 'ASC', name: 'ASC' },
      });
    }
    return this.categoryRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findAll(includeInactive = false): Promise<ExpenseCategory[]> {
    const query = this.categoryRepo.createQueryBuilder('category');

    if (!includeInactive) {
      query.where('category.isActive = :isActive', { isActive: true });
    }

    return query.orderBy('category.name', 'ASC').getMany();
  }

  async findOne(id: string): Promise<ExpenseCategory> {
    const category = await this.categoryRepo.findOne({ where: { id } });

    if (!category) {
      throw new NotFoundException(`Expense category with ID ${id} not found`);
    }

    return category;
  }

  async update(id: string, updateDto: UpdateExpenseCategoryDto): Promise<ExpenseCategory> {
    const category = await this.findOne(id);

    // Prevent updating system categories' core properties
    if (category.isSystem && (updateDto.name || updateDto.isSystem !== undefined)) {
      throw new BadRequestException('Cannot modify name or system status of system categories');
    }

    // Check for duplicate name if name is being updated
    if (updateDto.name && updateDto.name !== category.name) {
      const existing = await this.categoryRepo.findOne({
        where: { name: updateDto.name },
      });

      if (existing) {
        throw new BadRequestException(`Category with name "${updateDto.name}" already exists`);
      }
    }

    Object.assign(category, updateDto);
    category.updatedAt = new Date();

    return this.categoryRepo.save(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);

    // Prevent deletion of system categories
    if (category.isSystem) {
      throw new BadRequestException('Cannot delete system categories');
    }

    // Check if category is being used by any expenses
    const expenseCount = await this.categoryRepo
      .createQueryBuilder('category')
      .leftJoin('category.expenses', 'expense')
      .where('category.id = :id', { id })
      .getCount();

    if (expenseCount > 0) {
      throw new BadRequestException(
        'Cannot delete category that is being used by expenses. Please reassign or delete those expenses first.',
      );
    }

    await this.categoryRepo.remove(category);
  }

  async toggleActive(id: string): Promise<ExpenseCategory> {
    const category = await this.findOne(id);

    category.isActive = !category.isActive;
    category.updatedAt = new Date();

    return this.categoryRepo.save(category);
  }
}
