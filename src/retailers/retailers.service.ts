import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Retailer } from './retailer.entity';
import { CreateRetailerDto } from './dto/create-retailer.dto';
import { UpdateRetailerDto } from './dto/update-retailer.dto';
import { BillingService } from '../billing/billing.service';
import { TenantContextService } from '../tenants/tenant-context.service';

@Injectable()
export class RetailersService {
  constructor(
    @InjectRepository(Retailer)
    private readonly retailerRepository: Repository<Retailer>,
    private readonly billingService: BillingService,
    private readonly tenantContext: TenantContextService,
  ) { }

  private getTenantId(): string | null {
    return this.tenantContext.getTenantId();
  }

  private tenantWhere(extra: any): any {
    const tenantId = this.getTenantId();
    return tenantId ? { ...extra, tenantId } : extra;
  }

  private applyTenant(query: SelectQueryBuilder<Retailer>): SelectQueryBuilder<Retailer> {
    const tenantId = this.getTenantId();
    if (tenantId) query.andWhere('retailer.tenantId = :tenantId', { tenantId });
    return query;
  }

  async create(createRetailerDto: CreateRetailerDto): Promise<Retailer> {
    const retailer = this.retailerRepository.create({
      ...createRetailerDto,
      tenantId: this.getTenantId() ?? undefined,
    });
    const saved = await this.retailerRepository.save(retailer);

    if (createRetailerDto.openingBalance && Number(createRetailerDto.openingBalance) !== 0) {
      await this.billingService.syncRetailerOpeningBalance(
        saved.id,
        saved.name,
        saved.phone,
        saved.address,
        Number(createRetailerDto.openingBalance),
      );
    }

    return saved;
  }

  async findAll(page?: number, limit?: number, search?: string) {
    const query = this.retailerRepository.createQueryBuilder('retailer')
      .orderBy('retailer.createdAt', 'DESC');

    this.applyTenant(query);

    if (search) {
      query.andWhere(
        '(retailer.name ILIKE :search OR retailer.phone ILIKE :search OR retailer.ownerName ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (page && limit) {
      const skip = (page - 1) * limit;
      const [data, total] = await query.skip(skip).take(limit).getManyAndCount();
      return { data, total, page, limit };
    }

    return query.getMany();
  }

  async findActive(): Promise<Retailer[]> {
    return this.retailerRepository.find({
      where: this.tenantWhere({ status: 'active' }),
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Retailer> {
    const retailer = await this.retailerRepository.findOne({ where: this.tenantWhere({ id }) });
    if (!retailer) {
      throw new NotFoundException(`Retailer with ID ${id} not found`);
    }
    return retailer;
  }

  async update(id: string, updateRetailerDto: UpdateRetailerDto): Promise<Retailer> {
    const retailer = await this.findOne(id);
    Object.assign(retailer, updateRetailerDto);
    retailer.updatedAt = new Date();
    const saved = await this.retailerRepository.save(retailer);

    if (updateRetailerDto.openingBalance !== undefined) {
      await this.billingService.syncRetailerOpeningBalance(
        saved.id,
        saved.name,
        saved.phone,
        saved.address,
        Number(updateRetailerDto.openingBalance),
      );
    }

    return saved;
  }

  async remove(id: string): Promise<void> {
    const retailer = await this.findOne(id);
    await this.retailerRepository.remove(retailer);
  }
}