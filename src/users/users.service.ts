import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { TenantContextService } from '../tenants/tenant-context.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getTenantId(): string | null {
    const id = this.tenantContext.getTenantId();
    if (id == null || id === '') return null;
    return String(id);
  }

  private tenantWhere(extra: any): any {
    const tenantId = this.getTenantId();
    return tenantId ? { ...extra, tenantId: String(tenantId) } : extra;
  }

  private normalizePhone(raw: string): string {
    let digits = (raw || '').replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length >= 12) {
      digits = digits.slice(-10);
    } else if (digits.startsWith('0') && digits.length === 11) {
      digits = digits.slice(1);
    } else if (digits.length > 10) {
      digits = digits.slice(-10);
    }
    if (digits.length === 10) return `+91${digits}`;
    return (raw || '').trim();
  }

  private resolveTenantId(requestTenantId?: string | number | null): string | null {
    if (requestTenantId != null && requestTenantId !== '') {
      return String(requestTenantId);
    }
    return this.getTenantId();
  }

  async findAll(requestTenantId?: string | number | null): Promise<User[]> {
    const tenantId = this.resolveTenantId(requestTenantId);
    if (!tenantId) return [];
    try {
      const rows = await this.usersRepository.manager.query(
        `SELECT COUNT(*)::int AS n FROM tenants`,
      );
      if (Number(rows?.[0]?.n ?? 0) === 1) {
        await this.usersRepository.query(
          `UPDATE users SET tenant_id = $1
           WHERE tenant_id IS NULL AND role IN ('staff', 'manager') AND password_hash IS NOT NULL`,
          [tenantId],
        );
      }
    } catch { /* listing must still work */ }

    return this.usersRepository
      .createQueryBuilder('user')
      .where('CAST(user.tenant_id AS TEXT) = :tid', { tid: String(tenantId) })
      .orderBy('user.name', 'ASC')
      .getMany();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    const tenantId = this.getTenantId();
    if (tenantId && String(user.tenantId) !== String(tenantId)) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async findByIdUnscoped(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    if (!email?.trim()) return null;
    return this.usersRepository.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    const normalized = this.normalizePhone(phone);
    const digits = (phone || '').replace(/\D/g, '').slice(-10);
    const candidates = Array.from(
      new Set(
        [normalized, phone, digits, `+91${digits}`, `91${digits}`, `0${digits}`].filter(
          (value) => !!value && String(value).length > 0,
        ),
      ),
    );
    const found = await this.usersRepository.findOne({
      where: candidates.map((p) => ({ phone: p })),
    });
    if (found) return found;
    if (digits.length !== 10) return null;
    const rows = await this.usersRepository.query(
      `SELECT id FROM users
       WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $1
       LIMIT 1`,
      [digits],
    );
    if (!rows?.[0]?.id) return null;
    return this.usersRepository.findOne({ where: { id: String(rows[0].id) } });
  }

  async findByIdentifier(identifier: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: [
        { email: identifier.toLowerCase() },
        { phone: identifier },
      ],
    });
  }

  async createPhoneUser(data: { name: string; phone: string }): Promise<User> {
    const existing = await this.findByPhone(data.phone);
    if (existing) {
      throw new ConflictException(`User with phone ${data.phone} already exists`);
    }
    const user = this.usersRepository.create({
      name: data.name,
      phone: data.phone,
      role: 'admin',
      status: 'active',
    });
    return this.usersRepository.save(user);
  }

  async create(
    dto: CreateUserDto,
    requestTenantId?: string | number | null,
    requestUserId?: string | number | null,
  ): Promise<User> {
    let tenantId = this.resolveTenantId(requestTenantId);

    if (!tenantId && requestUserId != null && requestUserId !== '') {
      const creator = await this.usersRepository.findOne({
        where: { id: String(requestUserId) },
      });
      if (creator?.tenantId) tenantId = String(creator.tenantId);
    }

    if (!tenantId) {
      const rows = await this.usersRepository.manager.query(
        `SELECT id FROM tenants ORDER BY id ASC LIMIT 2`,
      );
      if (rows?.length === 1) tenantId = String(rows[0].id);
    }

    if (!tenantId) {
      throw new ForbiddenException('Cannot create users until this account is linked to a business.');
    }
    if (!dto.phone?.trim()) {
      throw new BadRequestException('Phone is required so the user can sign in.');
    }
    const phone = this.normalizePhone(dto.phone);
    const digits = phone.replace(/\D/g, '').slice(-10);
    const email = dto.email?.trim()
      ? dto.email.trim().toLowerCase()
      : `${digits}@poultrysathi.in`;

    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException(`User with email ${email} already exists`);
    }
    const existingPhone = await this.findByPhone(phone);
    if (existingPhone) {
      throw new ConflictException(
        `Phone ${dto.phone} is already used by ${existingPhone.name}. Use a different number.`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepository.create({
      name: dto.name,
      email,
      phone,
      passwordHash,
      role: dto.role ?? 'staff',
      status: dto.status ?? 'active',
      notes: dto.notes,
      tenantId,
      joinDate: new Date().toISOString().slice(0, 10),
    });

    try {
      const saved = await this.usersRepository.save(user);
      await this.usersRepository.query(
        `UPDATE users SET tenant_id = $1, phone = $2, join_date = COALESCE(join_date, CURRENT_DATE) WHERE id = $3`,
        [tenantId, phone, saved.id],
      );
      const linked = await this.usersRepository.findOne({ where: { id: saved.id } });
      return linked ?? saved;
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('A user with this email or phone already exists');
      }
      throw error;
    }
  }

  async ensureTenantForLogin(user: User): Promise<User> {
    if (user.tenantId) return user;
    const role = (user.role || '').toLowerCase();
    if (role === 'admin') return user;

    const rows = await this.usersRepository.manager.query(
      `SELECT id FROM tenants ORDER BY id ASC LIMIT 2`,
    );
    if (!rows || rows.length !== 1) {
      throw new UnauthorizedException(
        'This account is not linked to a business. Ask your admin to recreate the user.',
      );
    }
    await this.usersRepository.query(
      `UPDATE users SET tenant_id = $1 WHERE id = $2`,
      [String(rows[0].id), user.id],
    );
    const linked = await this.usersRepository.findOne({ where: { id: user.id } });
    if (!linked?.tenantId) {
      throw new UnauthorizedException(
        'This account is not linked to a business. Ask your admin to recreate the user.',
      );
    }
    return linked;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (dto.email !== undefined && dto.email.toLowerCase() !== user.email) {
      const existingUser = await this.findByEmail(dto.email.toLowerCase());
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException(`User with email ${dto.email} already exists`);
      }
    }

    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.email !== undefined) user.email = dto.email.toLowerCase();
    if (dto.phone !== undefined) user.phone = this.normalizePhone(dto.phone);
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.status !== undefined) user.status = dto.status;
    if (dto.notes !== undefined) user.notes = dto.notes;

    try {
      return await this.usersRepository.save(user);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException(`User with email ${dto.email} already exists`);
      }
      throw error;
    }
  }

  async deactivate(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.status = 'inactive';
    return this.usersRepository.save(user);
  }

  async activate(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.status = 'active';
    return this.usersRepository.save(user);
  }

  async getUserStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    adminUsers: number;
    managerUsers: number;
    staffUsers: number;
  }> {
    const where = this.tenantWhere({});
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      adminUsers,
      managerUsers,
      staffUsers,
    ] = await Promise.all([
      this.usersRepository.count({ where }),
      this.usersRepository.count({ where: { ...where, status: 'active' } }),
      this.usersRepository.count({ where: { ...where, status: 'inactive' } }),
      this.usersRepository.count({ where: { ...where, role: 'admin' } }),
      this.usersRepository.count({ where: { ...where, role: 'manager' } }),
      this.usersRepository.count({ where: { ...where, role: 'staff' } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      adminUsers,
      managerUsers,
      staffUsers,
    };
  }

  async updateTenantId(id: string, tenantId: string): Promise<User> {
    await this.usersRepository.query(
      `UPDATE users SET tenant_id = $1 WHERE id = $2`,
      [String(tenantId), id],
    );
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.usersRepository.update(id, { lastLogin: new Date() });
  }

  async updateSessionToken(id: string, sessionToken: string | null): Promise<void> {
    await this.usersRepository.update(id, {
      sessionToken,
      lastLogin: new Date(),
    });
  }

  async setTwoFactorSecret(id: string, secret: string | null): Promise<void> {
    await this.usersRepository.update(id, { twoFactorSecret: secret });
  }

  async enableTwoFactor(id: string, backupCodes: string[]): Promise<void> {
    const hashedCodes = await Promise.all(backupCodes.map(c => bcrypt.hash(c, 10)));
    await this.usersRepository.update(id, {
      isTwoFactorEnabled: true,
      twoFactorBackupCodes: JSON.stringify(hashedCodes),
    });
  }

  async disableTwoFactor(id: string): Promise<void> {
    await this.usersRepository.update(id, {
      isTwoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
    });
  }

  async consumeBackupCode(id: string, code: string): Promise<boolean> {
    const user = await this.findOne(id);
    if (!user.twoFactorBackupCodes) return false;
    const hashed: string[] = JSON.parse(user.twoFactorBackupCodes);
    for (let i = 0; i < hashed.length; i++) {
      const match = await bcrypt.compare(code.replace(/-/g, ''), hashed[i]);
      if (match) {
        hashed.splice(i, 1);
        await this.usersRepository.update(id, { twoFactorBackupCodes: JSON.stringify(hashed) });
        return true;
      }
    }
    return false;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
  }
}
