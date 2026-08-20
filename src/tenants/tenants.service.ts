import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { Settings } from '../settings/settings.entity';
import { RolePermission } from '../permissions/entities/role-permission.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';

interface PermissionSeed {
  resource: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

const RESOURCES = [
  'dashboard',
  'godown',
  'purchases',
  'sales',
  'mortality',
  'expenses',
  'reports',
  'billing',
  'farmers',
  'retailers',
  'vehicles',
  'users',
  'settings',
];

const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionSeed[]> = {
  admin: RESOURCES.map((resource) => ({
    resource,
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
  })),
  manager: [
    { resource: 'dashboard', canCreate: true, canRead: true, canUpdate: true, canDelete: false },
    { resource: 'godown', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'purchases', canCreate: true, canRead: true, canUpdate: true, canDelete: false },
    { resource: 'sales', canCreate: true, canRead: true, canUpdate: true, canDelete: false },
    { resource: 'mortality', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'expenses', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'reports', canCreate: false, canRead: false, canUpdate: false, canDelete: false },
    { resource: 'billing', canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    { resource: 'farmers', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'retailers', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'vehicles', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'users', canCreate: false, canRead: false, canUpdate: false, canDelete: false },
    { resource: 'settings', canCreate: false, canRead: true, canUpdate: false, canDelete: false },
  ],
  staff: [
    { resource: 'dashboard', canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    { resource: 'godown', canCreate: true, canRead: true, canUpdate: true, canDelete: false },
    { resource: 'purchases', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'sales', canCreate: true, canRead: true, canUpdate: true, canDelete: false },
    { resource: 'mortality', canCreate: true, canRead: true, canUpdate: true, canDelete: false },
    { resource: 'expenses', canCreate: true, canRead: true, canUpdate: true, canDelete: false },
    { resource: 'reports', canCreate: true, canRead: true, canUpdate: false, canDelete: false },
    { resource: 'billing', canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    { resource: 'farmers', canCreate: false, canRead: true, canUpdate: true, canDelete: false },
    { resource: 'retailers', canCreate: false, canRead: true, canUpdate: true, canDelete: false },
    { resource: 'vehicles', canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    { resource: 'users', canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    { resource: 'settings', canCreate: false, canRead: true, canUpdate: false, canDelete: false },
  ],
};

export interface CreateTenantData {
  name: string;
  type?: string;
  phone?: string;
  email?: string;
  address?: string;
  currency?: string;
  countryCode?: string;
}

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Settings)
    private readonly settingsRepository: Repository<Settings>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  async create(userId: string, data: CreateTenantData) {
    const existing = await this.usersService.findOne(userId);
    if (existing.tenantId) {
      throw new ConflictException(
        'You already have a business shop. One user can only own one shop.',
      );
    }

    const tenant = this.tenantRepository.create({
      name: data.name,
      type: data.type || 'poultry_trader',
      phone: data.phone,
      email: data.email,
      address: data.address,
      currency: data.currency || 'INR',
      countryCode: data.countryCode || '+91',
    });
    const saved = await this.tenantRepository.save(tenant);
    const savedId: string = (saved as any).id ?? (saved as any)[0]?.id;

    // Seed per-tenant default settings so the app works immediately for the new business
    await this.seedDefaultSettings(savedId, data);

    // Seed per-tenant default role permissions so the sidebar/navigation works immediately
    await this.seedDefaultRolePermissions(savedId);

    // Attach user to the tenant and re-issue a token that carries tenantId
    const token = await this.authService.attachTenant(userId, savedId);

    return { tenant: saved, ...token };
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  async findByUserId(userId: string): Promise<Tenant | null> {
    const user = await this.usersService.findOne(userId);
    if (!user.tenantId) return null;
    return this.findById(user.tenantId);
  }

  private async seedDefaultSettings(tenantId: string, data: CreateTenantData) {
    const defaults: Array<{ key: string; value: string; category: string; description?: string }> = [
      { key: 'farmName', value: data.name, category: 'general', description: 'Business name' },
      { key: 'businessType', value: data.type || 'poultry_trader', category: 'general', description: 'Business type' },
      { key: 'currency', value: data.currency || 'INR', category: 'general', description: 'System currency' },
      { key: 'countryCode', value: data.countryCode || '+91', category: 'general', description: 'Country code' },
      { key: 'theme', value: 'light', category: 'appearance', description: 'UI theme' },
      { key: 'businessCreated', value: 'true', category: 'general', description: 'Business onboarding completed' },
    ];
    if (data.address) defaults.push({ key: 'farmLocation', value: data.address, category: 'general' });
    if (data.email) defaults.push({ key: 'farmEmail', value: data.email, category: 'general' });
    if (data.phone) defaults.push({ key: 'farmPhone', value: data.phone, category: 'general' });

    const rows = defaults.map((s) =>
      this.settingsRepository.create({
        tenantId,
        key: s.key,
        value: s.value,
        category: s.category,
        description: s.description,
      }),
    );
    await this.settingsRepository.save(rows);
  }

  private async seedDefaultRolePermissions(tenantId: string) {
    const rows: RolePermission[] = [];
    for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const p of perms) {
        rows.push(
          this.rolePermissionRepository.create({
            role,
            resource: p.resource,
            canCreate: p.canCreate,
            canRead: p.canRead,
            canUpdate: p.canUpdate,
            canDelete: p.canDelete,
            tenantId,
          }),
        );
      }
    }
    await this.rolePermissionRepository.save(rows);
  }
}