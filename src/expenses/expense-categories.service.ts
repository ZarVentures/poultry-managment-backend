import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseCategory } from './entities/expense-category.entity';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

@Injectable()
export class ExpenseCategoriesService {
  constructor(
    @InjectRepository(ExpenseCategory)
    private categoryRepository: Repository<ExpenseCategory>,
  ) {}

  async create(createDto: CreateExpenseCategoryDto): Promise<ExpenseCategory> {
    // Check if category with same name already exists
    const existing = await this.categoryRepository.findOne({
      where: { name: createDto.name },
    });

    if (existing) {
      throw new ConflictException(`Category with name "${createDto.name}" already exists`);
    }

    const category = this.categoryRepository.create(createDto);
    return await this.categoryRepository.save(category);
  }

  async findAll(): Promise<ExpenseCategory[]> {
    return await this.categoryRepository.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findActive(): Promise<ExpenseCategory[]> {
    return await this.categoryRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<ExpenseCategory> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Expense category with ID ${id} not found`);
    }
    return category;
  }

  async update(id: number, updateDto: UpdateExpenseCategoryDto): Promise<ExpenseCategory> {
    const category = await this.findOne(id);

    // If name is being updated, check for conflicts
    if (updateDto.name && updateDto.name !== category.name) {
      const existing = await this.categoryRepository.findOne({
        where: { name: updateDto.name },
      });
      if (existing) {
        throw new ConflictException(`Category with name "${updateDto.name}" already exists`);
      }
    }

    Object.assign(category, updateDto);
    return await this.categoryRepository.save(category);
  }

  async remove(id: number): Promise<void> {
    const category = await this.findOne(id);
    
    // Prevent deletion of default categories
    if (category.isDefault) {
      throw new ConflictException('Cannot delete default categories');
    }

    await this.categoryRepository.remove(category);
  }

  async seedDefaultCategories(): Promise<void> {
    const defaultCategories = [
      { name: 'Diesel (For Big Vehicle)', description: 'Fuel for large vehicles', sortOrder: 1 },
      { name: 'Feed', description: 'Animal feed expenses', sortOrder: 2 },
      { name: 'Worker Salary', description: 'Employee salaries and wages', sortOrder: 3 },
      { name: 'Shop Rent', description: 'Rental expenses', sortOrder: 4 },
      { name: 'Electricity Bill', description: 'Utility - Electricity', sortOrder: 5 },
      { name: 'Petrol (For Two Wheelers)', description: 'Fuel for small vehicles', sortOrder: 6 },
      { name: 'Worker Incentive', description: 'Employee bonuses and incentives', sortOrder: 7 },
      { name: 'Stationary', description: 'Office supplies', sortOrder: 8 },
      { name: 'Cleaning', description: 'Cleaning and maintenance', sortOrder: 9 },
      { name: 'Snacks (Chai, Samosa, etc.)', description: 'Refreshments and snacks', sortOrder: 10 },
      { name: 'Misc Expenses', description: 'Miscellaneous expenses', sortOrder: 11 },
    ];

    for (const cat of defaultCategories) {
      const existing = await this.categoryRepository.findOne({
        where: { name: cat.name },
      });

      if (!existing) {
        await this.categoryRepository.save(
          this.categoryRepository.create({ ...cat, isDefault: true, isActive: true }),
        );
      }
    }

    console.log('✅ Default expense categories seeded');
  }
}
