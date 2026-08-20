import { Body, Controller, Get, Post, Request, UseGuards, Param, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SendOtpDto, VerifyOtpDto, RegisterSendOtpDto, RegisterVerifyOtpDto } from './dto/otp.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Legacy email/password login (kept for backward compat) ────────────────
  @Post('login')
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.email, body.password);
    return this.authService.login(user);
  }

  // ── Phone + OTP: Login ────────────────────────────────────────────────────
  @Post('login/send-otp')
  async loginSendOtp(@Body() body: SendOtpDto) {
    return this.authService.loginSendOtp(body.phoneNumber);
  }

  @Post('login/verify-otp')
  async loginVerifyOtp(@Body() body: VerifyOtpDto) {
    return this.authService.loginVerifyOtp(body.phoneNumber, body.otp);
  }

  // ── Phone + OTP: Registration ─────────────────────────────────────────────
  @Post('register/send-otp')
  async registerSendOtp(@Body() body: RegisterSendOtpDto) {
    return this.authService.registerSendOtp(body.name, body.phoneNumber);
  }

  @Post('register/verify-otp')
  async registerVerifyOtp(@Body() body: RegisterVerifyOtpDto) {
    return this.authService.registerVerifyOtp(body.name, body.phoneNumber, body.otp);
  }

  // ── Profile ───────────────────────────────────────────────────────────────
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: any) {
    return {
      userId: req.user.userId,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role,
      tenantId: req.user.tenantId ?? null,
    };
  }

  // ── 2FA endpoints (unchanged) ──────────────────────────────────────────────

  @Post('2fa/generate')
  @UseGuards(JwtAuthGuard)
  async generate2FA(@Request() req: any) {
    return this.authService.generate2FASecret(req.user.userId);
  }

  @Post('2fa/turn-on')
  @UseGuards(JwtAuthGuard)
  async turnOn2FA(@Request() req: any, @Body('code') code: string) {
    return this.authService.turnOn2FA(req.user.userId, code);
  }

  @Post('2fa/authenticate')
  async authenticate2FA(@Body('tempToken') tempToken: string, @Body('code') code: string) {
    return this.authService.authenticate2FA(tempToken, code);
  }

  @Post('2fa/turn-off')
  @UseGuards(JwtAuthGuard)
  async turnOff2FA(@Request() req: any, @Body('code') code: string) {
    await this.authService.turnOff2FA(req.user.userId, code);
    return { message: '2FA disabled successfully' };
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  async get2FAStatus(@Request() req: any) {
    const user = await this.authService['usersService'].findOne(req.user.userId);
    return { isTwoFactorEnabled: user.isTwoFactorEnabled };
  }

  @Post('2fa/admin-reset/:userId')
  @UseGuards(JwtAuthGuard)
  async adminReset2FA(@Request() req: any, @Param('userId') userId: string) {
    if (req.user.role !== 'admin') throw new UnauthorizedException('Admin access required');
    await this.authService['usersService'].disableTwoFactor(userId);
    return { message: `2FA has been reset for user ${userId}.` };
  }
}
