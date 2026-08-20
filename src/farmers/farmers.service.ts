import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Farmer } from './farmer.entity';
import { CreateFarmerDto } from './dto/create-farmer.dto';
import { UpdateFarmerDto } from './dto/update-farmer.dto';
import { BillingService } from '../billing/billing.service';
import { TenantContextService } from '../tenants/tenant-context.service';

@Injectable()
export class FarmersService {
  constructor(
    @InjectRepository(Farmer)
    private readonly farmerRepository: Repository<Farmer>,
    private readonly billingService: BillingService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getTenantId(): string | null {
    return this.tenantContext.getTenantId();
  }

  private tenantWhere(extra: any): any {
    const tenantId = this.getTenantId();
    return tenantId ? { ...extra, tenantId } : extra;
  }

  private applyTenant(query: SelectQueryBuilder<Farmer>): SelectQueryBuilder<Farmer> {
    const tenantId = this.getTenantId();
    if (tenantId) query.andWhere('farmer.tenantId = :tenantId', { tenantId });
    return query;
  }

  async create(createFarmerDto: CreateFarmerDto): Promise<Farmer> {
    const farmer = this.farmerRepository.create({
      ...createFarmerDto,
      tenantId: this.getTenantId() ?? undefined,
    });
    const saved = await this.farmerRepository.save(farmer);

    if (createFarmerDto.openingBalance && Number(createFarmerDto.openingBalance) !== 0) {
      await this.billingService.syncFarmerOpeningBalance(
        saved.id,
        saved.name,
        saved.phone,
        saved.address,
        Number(createFarmerDto.openingBalance),
      );
    }

    return saved;
  }

  async findAll(page: number = 1, limit: number = 100, search?: string, status?: string) {
    const query = this.farmerRepository.createQueryBuilder('farmer');

    this.applyTenant(query);

    // Search filter
    if (search) {
      query.andWhere(
        '(farmer.name ILIKE :search OR farmer.phone ILIKE :search OR farmer.email ILIKE :search OR farmer.address ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Status filter
    if (status) {
      query.andWhere('farmer.status = :status', { status });
    }

    // Pagination
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    // Order by created date
    query.orderBy('farmer.createdAt', 'DESC');

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findActive(): Promise<Farmer[]> {
    return this.farmerRepository.find({
      where: this.tenantWhere({ status: 'active' }),
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Farmer> {
    const farmer = await this.farmerRepository.findOne({ where: this.tenantWhere({ id }) });
    if (!farmer) {
      throw new NotFoundException(`Farmer with ID ${id} not found`);
    }
    return farmer;
  }

  async update(id: string, updateFarmerDto: UpdateFarmerDto): Promise<Farmer> {
    const farmer = await this.findOne(id);
    Object.assign(farmer, updateFarmerDto);
    farmer.updatedAt = new Date();
    const saved = await this.farmerRepository.save(farmer);

    if (updateFarmerDto.openingBalance !== undefined) {
      await this.billingService.syncFarmerOpeningBalance(
        saved.id,
        saved.name,
        saved.phone,
        saved.address,
        Number(updateFarmerDto.openingBalance),
      );
    }

    return saved;
  }

  async remove(id: string): Promise<void> {
    const farmer = await this.findOne(id);
    await this.farmerRepository.remove(farmer);
  }
}