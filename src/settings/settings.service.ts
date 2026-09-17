import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from './settings.entity';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { TenantContextService } from '../tenants/tenant-context.service';
import { Tenant } from '../tenants/tenant.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Settings)
    private readonly settingsRepository: Repository<Settings>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getTenantId(): string | null {
    return this.tenantContext.getTenantId();
  }

  async findAll(): Promise<Settings[]> {
    const query = this.settingsRepository.createQueryBuilder('s')
      .orderBy('s.category', 'ASC')
      .addOrderBy('s.key', 'ASC');

    const tenantId = this.getTenantId();
    if (tenantId) query.where('s.tenantId = :tenantId', { tenantId });

    return query.getMany();
  }

  async findOne(id: string): Promise<Settings> {
    const where: any = { key: id };
    const tenantId = this.getTenantId();
    if (tenantId) where.tenantId = tenantId;

    const setting = await this.settingsRepository.findOne({ where });
    if (!setting) {
      throw new NotFoundException(`Setting with id ${id} not found`);
    }
    return setting;
  }

  async findByKey(key: string): Promise<Settings | null> {
    const where: any = { key };
    const tenantId = this.getTenantId();
    if (tenantId) where.tenantId = tenantId;
    return this.settingsRepository.findOne({ where });
  }

  async findByCategory(category: string): Promise<Settings[]> {
    const where: any = { category };
    const tenantId = this.getTenantId();
    if (tenantId) where.tenantId = tenantId;
    return this.settingsRepository.find({
      where,
      order: { key: 'ASC' }
    });
  }

  async create(dto: CreateSettingDto): Promise<Settings> {
    return this.upsertByKey(dto.key, dto.value, dto.category, dto.description);
  }

  async update(id: string, dto: UpdateSettingDto): Promise<Settings> {
    const setting = await this.findOne(id);

    if (dto.key !== undefined) setting.key = dto.key;
    if (dto.value !== undefined) setting.value = dto.value;
    if (dto.category !== undefined) setting.category = dto.category;
    if (dto.description !== undefined) setting.description = dto.description;

    setting.updatedAt = new Date();
    return this.settingsRepository.save(setting);
  }

  async updateByKey(key: string, value: string): Promise<Settings> {
    const setting = await this.findByKey(key);
    if (!setting) {
      throw new NotFoundException(`Setting with key ${key} not found`);
    }
    setting.value = value;
    setting.updatedAt = new Date();
    return this.settingsRepository.save(setting);
  }

  async upsertByKey(key: string, value: string, category?: string, description?: string): Promise<Settings> {
    const existing = await this.findByKey(key);
    let saved: Settings;
    if (existing) {
      existing.value = value;
      if (category) existing.category = category;
      if (description) existing.description = description;
      existing.updatedAt = new Date();
      saved = await this.settingsRepository.save(existing);
    } else {
      saved = await this.settingsRepository.save(
        this.settingsRepository.create({
          key,
          value,
          category,
          description,
          tenantId: this.getTenantId() ?? undefined,
        }),
      );
    }

    if (key === 'farmName' || key === 'company_name') {
      await this.syncBusinessName(value, key);
    }

    return saved;
  }

  private async syncBusinessName(name: string, sourceKey: string): Promise<void> {
    const tenantId = this.getTenantId();
    if (tenantId) {
      await this.tenantRepository.update({ id: tenantId }, { name });
    }

    const otherKey = sourceKey === 'farmName' ? 'company_name' : 'farmName';
    const other = await this.findByKey(otherKey);
    if (other) {
      if (other.value !== name) {
        other.value = name;
        other.updatedAt = new Date();
        await this.settingsRepository.save(other);
      }
      return;
    }

    await this.settingsRepository.save(
      this.settingsRepository.create({
        key: otherKey,
        value: name,
        category: otherKey === 'farmName' ? 'general' : 'company',
        description: 'Business name',
        tenantId: tenantId ?? undefined,
      }),
    );
  }

  async delete(id: string): Promise<void> {
    const setting = await this.findOne(id);
    await this.settingsRepository.remove(setting);
  }

  async getAppSettings(): Promise<{
    currency: string;
    theme: string;
    companyName: string;
    companyEmail: string;
    companyPhone: string;
    companyAddress: string;
  }> {
    const settings = await this.findAll();
    const settingsMap = new Map(settings.map(s => [s.key, s.value]));

    return {
      currency: settingsMap.get('currency') || 'INR',
      theme: settingsMap.get('theme') || 'light',
      companyName: settingsMap.get('company_name') || settingsMap.get('farmName') || '',
      companyEmail: settingsMap.get('company_email') || settingsMap.get('farmEmail') || '',
      companyPhone: settingsMap.get('company_phone') || settingsMap.get('farmPhone') || '',
      companyAddress: settingsMap.get('company_address') || settingsMap.get('farmLocation') || '',
    };
  }

  async updateAppSettings(settings: {
    currency?: string;
    theme?: string;
    companyName?: string;
    companyEmail?: string;
    companyPhone?: string;
    companyAddress?: string;
  }): Promise<void> {
    const updates: Promise<Settings>[] = [];

    if (settings.currency !== undefined) {
      updates.push(this.upsertByKey('currency', settings.currency, 'general', 'System currency'));
    }
    if (settings.theme !== undefined) {
      updates.push(this.upsertByKey('theme', settings.theme, 'appearance', 'UI theme'));
    }
    if (settings.companyName !== undefined) {
      updates.push(this.upsertByKey('company_name', settings.companyName, 'company', 'Company name'));
    }
    if (settings.companyEmail !== undefined) {
      updates.push(this.upsertByKey('company_email', settings.companyEmail, 'company', 'Company email'));
    }
    if (settings.companyPhone !== undefined) {
      updates.push(this.upsertByKey('company_phone', settings.companyPhone, 'company', 'Company phone'));
    }
    if (settings.companyAddress !== undefined) {
      updates.push(this.upsertByKey('company_address', settings.companyAddress, 'company', 'Company address'));
    }

    await Promise.all(updates);
  }
}