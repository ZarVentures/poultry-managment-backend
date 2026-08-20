import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { generateSecret, verify } from 'otplib';
import * as QRCode from 'qrcode';
import { UsersService } from '../users/users.service';
import { OtpService } from './otp.service';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
  ) {}

  // ── Legacy email/password (kept for backward compat) ─────────────────────
  async validateUser(email: string, pass: string): Promise<User> {
    const user = await this.usersService.findByEmail(email.toLowerCase());
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (!user.passwordHash) throw new UnauthorizedException('This account uses phone-based login. Please use OTP.');

    const matches = await bcrypt.compare(pass, user.passwordHash);
    if (!matches) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== 'active') throw new UnauthorizedException('User is inactive');

    return user;
  }

  // ── Phone + OTP: Login ────────────────────────────────────────────────────
  async loginSendOtp(phoneNumber: string): Promise<{ message: string; devOtp?: string }> {
    const user = await this.usersService.findByPhone(phoneNumber);
    if (!user) throw new UnauthorizedException('No account found with this phone number.');
    if (user.status !== 'active') throw new UnauthorizedException('User account is inactive.');

    const otp = await this.otpService.generateSecureOtp(phoneNumber);
    await this.otpService.sendOtpSms(phoneNumber, otp);

    // Always include devOtp in response; front-end decides whether to display it
    return { message: 'OTP sent successfully', devOtp: otp };
  }

  async loginVerifyOtp(phoneNumber: string, otp: string) {
    await this.otpService.verifyOtp(phoneNumber, otp);

    const user = await this.usersService.findByPhone(phoneNumber);
    if (!user) throw new UnauthorizedException('User not found.');

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
    if (user.isTwoFactorEnabled) {
      const tempPayload = { sub: user.id, email: user.email, phone: user.phone, twoFactorPending: true };
      const tempToken = await this.jwtService.signAsync(tempPayload, { expiresIn: '5m' });
      return { status: '2FA_REQUIRED', tempToken };
    }
    return this.issueFullToken(user);
  }

  async issueFullToken(user: User) {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    await this.usersService.updateSessionToken(user.id, sessionToken);

    const payload = { sub: user.id, email: user.email, phone: user.phone, role: user.role, tenantId: user.tenantId ?? null, sessionToken };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, tenantId: user.tenantId ?? null },
    };
  }

  // Attach a user to a newly created tenant and re-issue a token carrying the tenantId
  async attachTenant(userId: string, tenantId: string) {
    const user = await this.usersService.updateTenantId(userId, tenantId);
    return this.issueFullToken(user);
  }

  async validateSession(userId: string, sessionToken: string): Promise<User> {
    const user = await this.usersService.findOne(userId);

    if (!user || user.sessionToken !== sessionToken) {
      throw new UnauthorizedException('Session expired. Another login was detected for this account.');
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('User is inactive');
    }
    return user;
  }

  // ── 2FA (unchanged) ──────────────────────────────────────────────────────

  async generate2FASecret(userId: string): Promise<{ otpauthUrl: string; qrCodeDataUrl: string; secret: string }> {
    const user = await this.usersService.findOne(userId);
    const secret = generateSecret();
    const appName = 'Aziz Poultry';
    const identifier = user.email || user.phone;
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
