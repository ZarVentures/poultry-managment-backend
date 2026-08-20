import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, Between, SelectQueryBuilder } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { TenantContextService } from '../tenants/tenant-context.service';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private inventoryRepository: Repository<InventoryItem>,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getTenantId(): string | null {
    return this.tenantContext.getTenantId();
  }

  private tenantWhere(extra: any): any {
    const tenantId = this.getTenantId();
    return tenantId ? { ...extra, tenantId } : extra;
  }

  private applyTenant(query: SelectQueryBuilder<InventoryItem>): SelectQueryBuilder<InventoryItem> {
    const tenantId = this.getTenantId();
    if (tenantId) query.andWhere('item.tenantId = :tenantId', { tenantId });
    return query;
  }

  async create(createInventoryItemDto: CreateInventoryItemDto): Promise<InventoryItem> {
    const item = this.inventoryRepository.create({
      ...createInventoryItemDto,
      lastUpdated: new Date(),
      tenantId: this.getTenantId() ?? undefined,
    });
    return await this.inventoryRepository.save(item);
  }

  async findAll(startDate?: string, endDate?: string): Promise<InventoryItem[]> {
    const query = this.inventoryRepository.createQueryBuilder('item');

    this.applyTenant(query);

    if (startDate && endDate) {
      query.where('item.lastUpdated BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    return await query.orderBy('item.itemName', 'ASC').getMany();
  }

  async findOne(id: string): Promise<InventoryItem> {
    const item = await this.inventoryRepository.findOne({ where: this.tenantWhere({ id: parseInt(id) }) });
    if (!item) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }
    return item;
  }

  async update(id: string, updateInventoryItemDto: UpdateInventoryItemDto): Promise<InventoryItem> {
    const item = await this.findOne(id);
    
    Object.assign(item, {
      ...updateInventoryItemDto,
      lastUpdated: new Date(),
    });

    return await this.inventoryRepository.save(item);
  }

  async remove(id: string): Promise<void> {
    const item = await this.findOne(id);
    await this.inventoryRepository.remove(item);
  }

  async getLowStockItems(): Promise<InventoryItem[]> {
    const query = this.inventoryRepository
      .createQueryBuilder('item')
      .where('item.currentStockLevel <= item.minimumStockLevel');
    this.applyTenant(query);
    return await query.orderBy('item.itemName', 'ASC').getMany();
  }

  async getTotalInventoryValue(): Promise<number> {
    const query = this.inventoryRepository
      .createQueryBuilder('item')
      .select('SUM(item.currentStockLevel)', 'total');
    this.applyTenant(query);
    const result = await query.getRawOne();
    
    return parseFloat(result?.total || '0');
  }

  async getInventoryByType(): Promise<Array<{ itemType: string; count: number; totalQuantity: number }>> {
    const query = this.inventoryRepository
      .createQueryBuilder('item')
      .select('item.itemType', 'itemType')
      .addSelect('COUNT(item.id)', 'count')
      .addSelect('SUM(item.currentStockLevel)', 'totalQuantity')
      .groupBy('item.itemType');
    this.applyTenant(query);
    const result = await query.getRawMany();

    return result.map(r => ({
      itemType: r.itemType,
      count: parseInt(r.count),
      totalQuantity: parseFloat(r.totalQuantity || '0'),
    }));
  }
}
