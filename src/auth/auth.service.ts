import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { generateSecret, generate, verify } from 'otplib';
import * as QRCode from 'qrcode';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<User> {
    const user = await this.usersService.findByEmail(email.toLowerCase());
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(pass, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('User is inactive');
    }

    return user;
  }

  async login(user: User) {
    // If 2FA is enabled, return a temp token instead of full access
    if (user.isTwoFactorEnabled) {
      const tempPayload = { sub: user.id, email: user.email, twoFactorPending: true };
      const tempToken = await this.jwtService.signAsync(tempPayload, { expiresIn: '5m' });
      return { status: '2FA_REQUIRED', tempToken };
    }

    return this.issueFullToken(user);
  }

  async issueFullToken(user: User) {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    await this.usersService.updateSessionToken(user.id, sessionToken);

    const payload = { sub: user.id, email: user.email, role: user.role, sessionToken };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async validateSession(userId: string, sessionToken: string): Promise<User> {
    const user = await this.usersService.findOne(userId);

    if (!user || user.sessionToken !== sessionToken) {
      throw new UnauthorizedException(
        'Session expired. Another login was detected for this account.',
      );
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('User is inactive');
    }

    return user;
  }

  // ── 2FA ──────────────────────────────────────────────────────────────────

  async generate2FASecret(userId: string): Promise<{ otpauthUrl: string; qrCodeDataUrl: string; secret: string }> {
    const user = await this.usersService.findOne(userId);
    const secret = generateSecret();
    const appName = 'Aziz Poultry';
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${encodeURIComponent(appName)}`;

    await this.usersService.setTwoFactorSecret(userId, secret);

    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { otpauthUrl, qrCodeDataUrl, secret };
  }

  private generateBackupCodes(): string[] {
    // Generate 8 recovery codes in XXXX-XXXX-XXXX-XXXX format
    return Array.from({ length: 8 }, () => {
      const hex = crypto.randomBytes(8).toString('hex').toUpperCase();
      return `${hex.slice(0,4)}-${hex.slice(4,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}`;
    });
  }

  async turnOn2FA(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const user = await this.usersService.findOne(userId);
    if (!user.twoFactorSecret) {
      throw new BadRequestException('2FA secret not generated. Call /auth/2fa/generate first.');
    }
    const isValid = verify({ token: code, secret: user.twoFactorSecret });
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }
    const backupCodes = this.generateBackupCodes();
    await this.usersService.enableTwoFactor(userId, backupCodes);
    // Return plain codes — shown ONCE, never again
    return { backupCodes };
  }

  async authenticate2FA(tempToken: string, code: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(tempToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired temp token');
    }

    if (!payload.twoFactorPending) {
      throw new UnauthorizedException('Token is not a 2FA pending token');
    }

    const user = await this.usersService.findOne(payload.sub);
    if (!user.twoFactorSecret || !user.isTwoFactorEnabled) {
      throw new UnauthorizedException('2FA not enabled for this user');
    }

    // Try TOTP code first
    const isValidTotp = verify({ token: code, secret: user.twoFactorSecret });
    if (isValidTotp) {
      return this.issueFullToken(user);
    }

    // Try backup code (strip dashes for comparison)
    const usedBackup = await this.usersService.consumeBackupCode(user.id, code.replace(/-/g, ''));
    if (usedBackup) {
      return this.issueFullToken(user);
    }

    throw new UnauthorizedException('Invalid 2FA code');
  }

  async turnOff2FA(userId: string, code: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (!user.twoFactorSecret || !user.isTwoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }
    const isValid = verify({ token: code, secret: user.twoFactorSecret });
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }
    await this.usersService.disableTwoFactor(userId);
  }
}
