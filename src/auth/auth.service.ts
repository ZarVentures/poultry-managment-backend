import { Injectable, UnauthorizedException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { generateSecret, verify } from 'otplib';
import * as QRCode from 'qrcode';
import { UsersService } from '../users/users.service';
import { OtpService } from './otp.service';
import { User } from '../users/user.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { asDate, isWithinRecoveryWindow } from './account-deletion.policy';
import { DeleteAccountDto, RecoverSendOtpDto, RecoverVerifyOtpDto, RestoreAccountDto } from './dto/account.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
    private readonly config: ConfigService,
    private readonly rateLimit: AuthRateLimitService,
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  private roleOf(user: User): string {
    return (user.role || '').trim().toLowerCase();
  }

  private assertAdminMobileLogin(user: User) {
    const role = this.roleOf(user);
    if (role === 'staff' || role === 'manager') {
      throw new UnauthorizedException(
        'Staff and managers sign in with email (password or OTP), not mobile.',
      );
    }
  }

  private assertStaffEmailLogin(user: User) {
    const role = this.roleOf(user);
    if (role === 'admin' || role === '') {
      throw new UnauthorizedException('Admins sign in with mobile OTP, not email.');
    }
    if (role !== 'staff' && role !== 'manager') {
      throw new UnauthorizedException('This account cannot sign in with email.');
    }
  }

  private emailOtpKey(email: string): string {
    return `email:${email.trim().toLowerCase()}`;
  }

  // ── Email + password (staff / manager) ───────────────────────────────────
  async validateUser(email: string, pass: string): Promise<User> {
    const user = await this.usersService.findByEmail(email.toLowerCase());
    if (!user || user.purgedAt) throw new UnauthorizedException('Invalid credentials');

    this.assertStaffEmailLogin(user);

    if (!user.passwordHash) {
      throw new UnauthorizedException('Set a password with your admin, or sign in with email OTP.');
    }

    const matches = await bcrypt.compare(pass, user.passwordHash);
    if (!matches) throw new UnauthorizedException('Invalid credentials');

    this.assertAccountAccess(user, 'Invalid credentials', 'User is inactive');

    return user;
  }

  // ── Phone + OTP: Admin login ──────────────────────────────────────────────
  async loginSendOtp(phoneNumber: string): Promise<{ message: string; devOtp?: string }> {
    const user = await this.usersService.findByPhone(phoneNumber);
    if (!user || user.purgedAt) throw new UnauthorizedException('No account found with this phone number.');
    this.assertAdminMobileLogin(user);
    this.assertAccountAccess(user, 'No account found with this phone number.', 'User account is inactive.');

    const otp = await this.otpService.generateSecureOtp(phoneNumber);
    await this.otpService.sendOtpSms(phoneNumber, otp);

    return { message: 'OTP sent successfully', devOtp: otp };
  }

  async loginVerifyOtp(phoneNumber: string, otp: string) {
    const user = await this.usersService.findByPhone(phoneNumber);
    if (!user || user.purgedAt) throw new UnauthorizedException('User not found.');
    this.assertAdminMobileLogin(user);
    this.assertAccountAccess(user, 'User not found.', 'User account is inactive.');

    await this.otpService.verifyOtp(phoneNumber, otp);
    return this.login(user);
  }

  // ── Email OTP: Staff / manager login ──────────────────────────────────────
  async loginSendEmailOtp(email: string): Promise<{ message: string; devOtp?: string }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalized);
    if (!user || user.purgedAt) throw new UnauthorizedException('No account found with this email.');
    this.assertStaffEmailLogin(user);
    this.assertAccountAccess(user, 'No account found with this email.', 'User account is inactive.');

    const key = this.emailOtpKey(normalized);
    const otp = await this.otpService.generateSecureOtp(key);
    await this.otpService.sendOtpEmail(normalized, otp);

    return { message: 'OTP sent successfully', devOtp: otp };
  }

  async loginVerifyEmailOtp(email: string, otp: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalized);
    if (!user || user.purgedAt) throw new UnauthorizedException('User not found.');
    this.assertStaffEmailLogin(user);
    this.assertAccountAccess(user, 'User not found.', 'User account is inactive.');

    await this.otpService.verifyOtp(this.emailOtpKey(normalized), otp);
    return this.login(user);
  }

  // ── Phone + OTP: Registration ─────────────────────────────────────────────
  async registerSendOtp(name: string, phoneNumber: string): Promise<{ message: string; devOtp?: string }> {
    const existing = await this.usersService.findByPhone(phoneNumber);
    if (existing) throw new ConflictException('An account with this phone number already exists.');

    const otp = await this.otpService.generateSecureOtp(phoneNumber);
    await this.otpService.sendOtpSms(phoneNumber, otp);

    return { message: 'OTP sent. Please verify your phone number.', devOtp: otp };
  }

  async registerVerifyOtp(name: string, phoneNumber: string, otp: string) {
    await this.otpService.verifyOtp(phoneNumber, otp);

    // Check again in case someone registered in between
    const existing = await this.usersService.findByPhone(phoneNumber);
    if (existing) throw new ConflictException('An account with this phone number already exists.');

    const user = await this.usersService.createPhoneUser({ name, phone: phoneNumber });
    return this.login(user);
  }

  // ── Session & Token Helpers ───────────────────────────────────────────────
  async login(user: User) {
    this.assertAccountAccess(user, 'User not found.', 'User is inactive');
    const linked = await this.usersService.ensureTenantForLogin(user);
    if (linked.isTwoFactorEnabled) {
      const tempPayload = { sub: linked.id, email: linked.email, phone: linked.phone, twoFactorPending: true };
      const tempToken = await this.jwtService.signAsync(tempPayload, { expiresIn: '5m' });
      return { status: '2FA_REQUIRED', tempToken };
    }
    return this.issueFullToken(linked);
  }

  async issueFullToken(user: User) {
    if (user.deletedAt || user.purgedAt || user.status !== 'active') {
      throw new UnauthorizedException('User is inactive');
    }
    if (user.tenantId && (await this.usersService.isOrganizationPendingDeletion(user.tenantId))) {
      throw new UnauthorizedException('This organization is scheduled for deletion.');
    }
    const sessionToken = crypto.randomBytes(32).toString('hex');
    await this.usersService.updateSessionToken(user.id, sessionToken);

    const tenantId = user.tenantId != null ? String(user.tenantId) : null;
    const payload = { sub: user.id, email: user.email, phone: user.phone, role: user.role, tenantId, sessionToken };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        tenantId,
        organizationId: tenantId,
      },
    };
  }

  // Attach a user to a newly created tenant and re-issue a token carrying the tenantId
  async attachTenant(userId: string, tenantId: string) {
    const user = await this.usersService.updateTenantId(userId, tenantId);
    return this.issueFullToken(user);
  }

  async validateSession(userId: string, sessionToken: string): Promise<User> {
    const user = await this.usersService.findByIdUnscoped(userId);

    if (!user || user.sessionToken !== sessionToken || user.deletedAt || user.purgedAt) {
      throw new UnauthorizedException('Session expired. Another login was detected for this account.');
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('User is inactive');
    }
    return user;
  }

  // ── Delete account + recovery ────────────────────────────────────────────

  private assertDeletionEnabled() {
    const flag = String(this.config.get('ACCOUNT_DELETION_ENABLED', 'true')).toLowerCase();
    if (flag === 'false' || flag === '0' || flag === 'off') {
      throw new NotFoundException('Account deletion is not available.');
    }
  }

  private recoveryDays(): number {
    const days = Number(this.config.get('ACCOUNT_RECOVERY_DAYS') || 30);
    return Number.isFinite(days) && days > 0 ? days : 30;
  }

  private devOtpField(otp: string): { devOtp?: string } {
    return this.config.get<string>('OTP_PROVIDER', 'dev') === 'dev' ? { devOtp: otp } : {};
  }

  private assertAccountAccess(user: User, goneMessage: string, inactiveMessage: string) {
    if (user.purgedAt) throw new UnauthorizedException(goneMessage);
    if (user.deletedAt) {
      if (isWithinRecoveryWindow(user)) {
        const expires = asDate(user.recoveryExpiresAt) ?? new Date();
        throw new UnauthorizedException({
          message: 'Your account is currently scheduled for deletion.',
          code: 'ACCOUNT_PENDING_DELETION',
          recoveryExpiresAt: expires.toISOString(),
        });
      }
      throw new UnauthorizedException(goneMessage);
    }
    if (user.status !== 'active') throw new UnauthorizedException(inactiveMessage);
  }

  private async assertCanSelfDelete(user: User) {
    if (user.purgedAt) throw new BadRequestException('This account can no longer be deleted.');
    if (user.deletedAt) {
      throw new ConflictException({
        message: 'This account is already scheduled for deletion.',
        code: 'ACCOUNT_ALREADY_PENDING_DELETION',
      });
    }
  }

  private async writeAudit(
    action: string,
    user: User,
    meta?: { ip?: string; userAgent?: string; description?: string; extra?: Record<string, unknown> },
  ) {
    try {
      await this.auditLogs.save(
        this.auditLogs.create({
          userId: user.id,
          userEmail: user.email || undefined,
          action,
          entity: 'users',
          entityId: String(user.id),
          tenantId: user.tenantId ? String(user.tenantId) : undefined,
          ipAddress: meta?.ip,
          userAgent: meta?.userAgent,
          description: meta?.description,
          newValues: meta?.extra,
        }),
      );
    } catch {
      // Audit must not block deletion or recovery.
    }
  }

  private deleteOtpTarget(user: User): { key: string; channel: 'sms' | 'email' } {
    const role = (user.role || '').trim().toLowerCase();
    if (role === 'staff' || role === 'manager') {
      if (!user.email) throw new BadRequestException('No email is registered on this account.');
      return { key: this.emailOtpKey(user.email.trim().toLowerCase()), channel: 'email' };
    }
    if (!user.phone) throw new BadRequestException('No phone number is registered on this account.');
    return { key: user.phone, channel: 'sms' };
  }

  async sendDeleteOtp(userId: string, ip?: string) {
    this.assertDeletionEnabled();
    this.rateLimit.hit(`delete-otp:${userId}`, 5, 60 * 60 * 1000);
    const user = await this.usersService.findByIdUnscoped(userId);
    if (!user) throw new UnauthorizedException();
    await this.assertCanSelfDelete(user);
    const deletesOrganization = await this.usersService.willDeleteOrganization(user);
    const target = this.deleteOtpTarget(user);
    const otp = await this.otpService.generateSecureOtp(target.key, 'delete');
    if (target.channel === 'email') {
      await this.otpService.sendOtpEmail(user.email!.trim().toLowerCase(), otp);
    } else {
      await this.otpService.sendOtpSms(user.phone!, otp);
    }
    await this.writeAudit('ACCOUNT_DELETE_REQUESTED', user, {
      ip,
      description: target.channel === 'email' ? 'Deletion OTP sent by email' : 'Deletion OTP sent by SMS',
    });
    return {
      message: 'OTP sent successfully',
      channel: target.channel,
      deletesOrganization,
      ...this.devOtpField(otp),
    };
  }

  async deleteAccount(
    userId: string,
    dto: DeleteAccountDto,
    meta?: { ip?: string; userAgent?: string },
  ) {
    this.assertDeletionEnabled();
    this.rateLimit.hit(`delete:${userId}`, 5, 60 * 60 * 1000);
    const user = await this.usersService.findByIdUnscoped(userId);
    if (!user) throw new UnauthorizedException();
    await this.assertCanSelfDelete(user);

    if (user.isTwoFactorEnabled) {
      if (!dto.totpCode || !user.twoFactorSecret) {
        throw new BadRequestException({
          message: 'Authenticator code is required.',
          code: 'TOTP_REQUIRED',
        });
      }
      const valid = (await verify({ token: dto.totpCode, secret: user.twoFactorSecret })).valid;
      if (!valid) throw new UnauthorizedException('Invalid 2FA code');
    }

    if (!dto.otp) {
      throw new BadRequestException({ message: 'OTP is required.', code: 'OTP_REQUIRED' });
    }
    const target = this.deleteOtpTarget(user);
    await this.otpService.verifyOtp(target.key, dto.otp, 'delete');

    const recoveryExpiresAt = new Date(Date.now() + this.recoveryDays() * 24 * 60 * 60 * 1000);
    const deletesOrganization = await this.usersService.willDeleteOrganization(user);
    await this.usersService.markPendingDeletion(user, {
      reason: dto.reason?.trim() || null,
      recoveryExpiresAt,
    });
    if (deletesOrganization && user.tenantId) {
      await this.usersService.closeOrganization(user.tenantId);
    }
    await this.writeAudit('ACCOUNT_DELETED', user, {
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      description: deletesOrganization
        ? 'Account and organization scheduled for deletion'
        : 'Account scheduled for deletion',
      extra: { recoveryExpiresAt: recoveryExpiresAt.toISOString(), deletesOrganization },
    });
    return {
      message: deletesOrganization
        ? 'Your account and organization are scheduled for deletion.'
        : 'Your account is scheduled for deletion.',
      recoveryExpiresAt: recoveryExpiresAt.toISOString(),
      deletesOrganization,
    };
  }

  async recoverSendOtp(dto: RecoverSendOtpDto, ip?: string) {
    this.assertDeletionEnabled();
    const phone = dto.phoneNumber?.trim();
    const email = dto.email?.trim().toLowerCase();
    if (!!phone === !!email) {
      throw new BadRequestException('Provide a phone number or an email.');
    }
    const identifier = phone || email || '';
    this.rateLimit.hit(`recover-send:${identifier}`, 20, 60 * 60 * 1000);
    if (ip) this.rateLimit.hit(`recover-send-ip:${ip}`, 60, 60 * 60 * 1000);

    const generic = { message: 'If this account can be recovered, a code has been sent.' };
    const user = phone
      ? await this.usersService.findByPhone(phone)
      : await this.usersService.findByEmail(email!);
    if (!user || !isWithinRecoveryWindow(user)) return generic;

    const role = (user.role || '').trim().toLowerCase();
    if (phone && (role === 'staff' || role === 'manager')) return generic;
    if (email && (role === 'admin' || role === '')) return generic;

    const key = phone ? user.phone : this.emailOtpKey(email!);
    if (!key) return generic;
    const otp = await this.otpService.generateSecureOtp(key, 'recover');
    if (phone) await this.otpService.sendOtpSms(user.phone!, otp);
    else await this.otpService.sendOtpEmail(email!, otp);
    await this.writeAudit('ACCOUNT_RECOVERY_OTP_SENT', user, {
      ip,
      description: phone ? 'Recovery OTP sent by SMS' : 'Recovery OTP sent by email',
    });
    return { ...generic, ...this.devOtpField(otp) };
  }

  async recoverVerifyOtp(dto: RecoverVerifyOtpDto, ip?: string) {
    this.assertDeletionEnabled();
    const phone = dto.phoneNumber?.trim();
    const email = dto.email?.trim().toLowerCase();
    if (!!phone === !!email) {
      throw new BadRequestException('Provide a phone number or an email.');
    }
    const identifier = phone || email || '';
    this.rateLimit.hit(`recover-verify:${identifier}`, 30, 60 * 60 * 1000);

    const user = phone
      ? await this.usersService.findByPhone(phone)
      : await this.usersService.findByEmail(email!);
    const key = phone ? user?.phone : email ? this.emailOtpKey(email) : null;
    if (!user || !key || !isWithinRecoveryWindow(user)) {
      throw new BadRequestException('This code is invalid or the recovery period has ended.');
    }

    try {
      await this.otpService.verifyOtp(key, dto.otp, 'recover');
    } catch (error) {
      await this.writeAudit('ACCOUNT_RECOVERY_FAILED', user, {
        ip,
        description: 'Recovery OTP rejected',
      });
      throw error;
    }

    const jti = crypto.randomBytes(16).toString('hex');
    const saved = await this.usersService.setRecoveryNonce(user.id, jti);
    if (!saved) {
      throw new BadRequestException('This code is invalid or the recovery period has ended.');
    }
    const recoveryToken = await this.jwtService.signAsync(
      { sub: user.id, purpose: 'account_recovery', jti },
      { expiresIn: '10m' },
    );
    return {
      recoveryToken,
      expiresIn: 600,
      twoFactorRequired: !!user.isTwoFactorEnabled,
    };
  }

  async restoreAccount(dto: RestoreAccountDto, meta?: { ip?: string; userAgent?: string }) {
    this.assertDeletionEnabled();
    let payload: { sub?: string; purpose?: string; jti?: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.recoveryToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired recovery token');
    }
    if (payload.purpose !== 'account_recovery' || !payload.sub || !payload.jti) {
      throw new UnauthorizedException('Invalid or expired recovery token');
    }

    const user = await this.usersService.findByIdUnscoped(payload.sub);
    if (!user || user.recoveryNonce !== payload.jti || !isWithinRecoveryWindow(user)) {
      throw new UnauthorizedException('Invalid or expired recovery token');
    }

    if (user.isTwoFactorEnabled) {
      if (!dto.totpCode || !user.twoFactorSecret) {
        throw new BadRequestException({
          message: 'Authenticator code is required.',
          code: 'TOTP_REQUIRED',
        });
      }
      const valid = (await verify({ token: dto.totpCode, secret: user.twoFactorSecret })).valid;
      if (!valid) throw new UnauthorizedException('Invalid 2FA code');
    }

    const restored = await this.usersService.restorePendingDeletion(user.id, payload.jti);
    if (!restored) {
      throw new ConflictException('This account could not be restored.');
    }
    if (
      restored.tenantId &&
      (restored.role || '').trim().toLowerCase() === 'admin'
    ) {
      await this.usersService.reopenOrganization(restored.tenantId);
    }
    await this.writeAudit('ACCOUNT_RECOVERED', restored, {
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      description: 'Account restored during the recovery window',
    });
    if (restored.status !== 'active') {
      throw new UnauthorizedException(
        'Your account was restored, but it is still deactivated. Ask an admin to activate it.',
      );
    }
    return this.issueFullToken(restored);
  }

  // ── 2FA (unchanged) ──────────────────────────────────────────────────────

  async generate2FASecret(userId: string): Promise<{ otpauthUrl: string; qrCodeDataUrl: string; secret: string }> {
    const user = await this.usersService.findOne(userId);
    const secret = generateSecret();
    const appName = 'Aziz Poultry';
    const identifier = user.email || user.phone || 'user';
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(identifier)}?secret=${secret}&issuer=${encodeURIComponent(appName)}`;

    await this.usersService.setTwoFactorSecret(userId, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { otpauthUrl, qrCodeDataUrl, secret };
  }

  private generateBackupCodes(): string[] {
    return Array.from({ length: 8 }, () => {
      const hex = crypto.randomBytes(8).toString('hex').toUpperCase();
      return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
    });
  }

  async turnOn2FA(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const user = await this.usersService.findOne(userId);
    if (!user.twoFactorSecret) throw new BadRequestException('2FA secret not generated. Call /auth/2fa/generate first.');
    const isValid = (await verify({ token: code, secret: user.twoFactorSecret })).valid;
    if (!isValid) throw new UnauthorizedException('Invalid 2FA code');
    const backupCodes = this.generateBackupCodes();
    await this.usersService.enableTwoFactor(userId, backupCodes);
    return { backupCodes };
  }

  async authenticate2FA(tempToken: string, code: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(tempToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired temp token');
    }

    if (!payload.twoFactorPending) throw new UnauthorizedException('Token is not a 2FA pending token');

    const user = await this.usersService.findOne(payload.sub);
    if (!user.twoFactorSecret || !user.isTwoFactorEnabled) throw new UnauthorizedException('2FA not enabled for this user');

    const isValidTotp = (await verify({ token: code, secret: user.twoFactorSecret })).valid;
    if (isValidTotp) return this.issueFullToken(user);

    const usedBackup = await this.usersService.consumeBackupCode(user.id, code.replace(/-/g, ''));
    if (usedBackup) return this.issueFullToken(user);

    throw new UnauthorizedException('Invalid 2FA code');
  }

  async turnOff2FA(userId: string, code: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (!user.twoFactorSecret || !user.isTwoFactorEnabled) throw new BadRequestException('2FA is not enabled');
    const isValid = (await verify({ token: code, secret: user.twoFactorSecret })).valid;
    if (!isValid) throw new UnauthorizedException('Invalid 2FA code');
    await this.usersService.disableTwoFactor(userId);
  }
}
