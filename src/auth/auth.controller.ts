import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.email, body.password);
    return this.authService.login(user);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: any) {
    return {
      userId: req.user.userId,
      email: req.user.email,
      role: req.user.role,
    };
  }

  // ── 2FA endpoints ─────────────────────────────────────────────────────────

  /** Step 1: Generate secret + QR code (user must be logged in) */
  @Post('2fa/generate')
  @UseGuards(JwtAuthGuard)
  async generate2FA(@Request() req: any) {
    return this.authService.generate2FASecret(req.user.userId);
  }

  /** Step 2: Verify first code and enable 2FA */
  @Post('2fa/turn-on')
  @UseGuards(JwtAuthGuard)
  async turnOn2FA(@Request() req: any, @Body('code') code: string) {
    await this.authService.turnOn2FA(req.user.userId, code);
    return { message: '2FA enabled successfully' };
  }

  /** Step 3: Called during login when 2FA is required */
  @Post('2fa/authenticate')
  async authenticate2FA(
    @Body('tempToken') tempToken: string,
    @Body('code') code: string,
  ) {
    return this.authService.authenticate2FA(tempToken, code);
  }

  /** Disable 2FA (requires valid code) */
  @Post('2fa/turn-off')
  @UseGuards(JwtAuthGuard)
  async turnOff2FA(@Request() req: any, @Body('code') code: string) {
    await this.authService.turnOff2FA(req.user.userId, code);
    return { message: '2FA disabled successfully' };
  }

  /** Get 2FA status for current user */
  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  async get2FAStatus(@Request() req: any) {
    const user = await this.authService['usersService'].findOne(req.user.userId);
    return { isTwoFactorEnabled: user.isTwoFactorEnabled };
  }
}

