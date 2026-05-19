import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseCategory } from '../expense-categories/expense-category.entity';
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
    const category = await this.categoryRepository.findOne({ where: { id: id as any } });
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
      { name: 'Feed', description: 'Animal feed expenses', sortOrder: 1 },
      { name: 'Labor', description: 'Employee salaries and wages', sortOrder: 2 },
      { name: 'Medicine', description: 'Medicine and treatment', sortOrder: 3 },
      { name: 'Utilities', description: 'Utility bills', sortOrder: 4 },
      { name: 'Equipment', description: 'Farm equipment and tools', sortOrder: 5 },
      { name: 'Maintenance', description: 'Farm maintenance and repairs', sortOrder: 6 },
      { name: 'Transportation', description: 'Transportation and logistics', sortOrder: 7 },
      { name: 'Other', description: 'Other expenses', sortOrder: 8 },
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
