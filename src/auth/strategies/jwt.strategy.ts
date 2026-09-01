import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tenantId?: string | null;
  sessionToken: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'change-this-jwt-secret'),
    });
  }

  async validate(payload: JwtPayload) {
    // Validate that this session is still the active one for this user
    const user = await this.authService.validateSession(
      payload.sub,
      payload.sessionToken,
    );

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId != null ? String(user.tenantId) : null,
    };
  }
}
