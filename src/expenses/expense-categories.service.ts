import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseCategory } from '../expense-categories/expense-category.entity';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';
import { TenantContextService } from '../tenants/tenant-context.service';

@Injectable()
export class ExpenseCategoriesService {
  constructor(
    @InjectRepository(ExpenseCategory)
    private categoryRepository: Repository<ExpenseCategory>,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getTenantId(): string | null {
    return this.tenantContext.getTenantId();
  }

  private tenantWhere(extra: any): any {
    const tenantId = this.getTenantId();
    return tenantId ? { ...extra, tenantId } : extra;
  }

  async create(createDto: CreateExpenseCategoryDto): Promise<ExpenseCategory> {
    // Check if category with same name already exists within this tenant
    const existing = await this.categoryRepository.findOne({
      where: this.tenantWhere({ name: createDto.name }),
    });

    if (existing) {
      throw new ConflictException(`Category with name "${createDto.name}" already exists`);
    }

    const category = this.categoryRepository.create({
      ...createDto,
      tenantId: this.getTenantId() ?? undefined,
    });
    return await this.categoryRepository.save(category);
  }

  async findAll(): Promise<ExpenseCategory[]> {
    return await this.categoryRepository.find({
      where: this.tenantWhere({}),
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findActive(type?: 'main' | 'godown'): Promise<ExpenseCategory[]> {
    if (type) {
      return await this.categoryRepository.find({
        where: [
          this.tenantWhere({ isActive: true, appliesTo: type }),
          this.tenantWhere({ isActive: true, appliesTo: 'both' })
        ],
        order: { sortOrder: 'ASC', name: 'ASC' },
      });
    }

    return await this.categoryRepository.find({
      where: this.tenantWhere({ isActive: true }),
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<ExpenseCategory> {
    const category = await this.categoryRepository.findOne({
      where: this.tenantWhere({ id: id as any }),
    });
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
        where: this.tenantWhere({ name: updateDto.name }),
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
    const tenantId = this.getTenantId();
    const defaultCategories = [
      { name: 'Feed', description: 'Animal feed expenses', sortOrder: 1, appliesTo: 'both' as const },
      { name: 'Labor', description: 'Employee salaries and wages', sortOrder: 2, appliesTo: 'both' as const },
      { name: 'Medicine', description: 'Medicine and treatment', sortOrder: 3, appliesTo: 'both' as const },
      { name: 'Utilities', description: 'Utility bills', sortOrder: 4, appliesTo: 'both' as const },
      { name: 'Equipment', description: 'Farm equipment and tools', sortOrder: 5, appliesTo: 'both' as const },
      { name: 'Maintenance', description: 'Farm maintenance and repairs', sortOrder: 6, appliesTo: 'both' as const },
      { name: 'Transportation', description: 'Transportation and logistics', sortOrder: 7, appliesTo: 'both' as const },
      { name: 'Other', description: 'Other expenses', sortOrder: 8, appliesTo: 'both' as const },
    ];

    for (const cat of defaultCategories) {
      const existing = await this.categoryRepository.findOne({
        where: this.tenantWhere({ name: cat.name }),
      });

      if (!existing) {
        await this.categoryRepository.save(
          this.categoryRepository.create({ ...cat, tenantId: tenantId ?? undefined, isDefault: true, isActive: true }),
        );
      }
    }

    console.log('✅ Default expense categories seeded');
  }
}