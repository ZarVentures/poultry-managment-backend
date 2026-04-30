import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
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
    // Generate a unique session token for this login
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Store it on the user — this invalidates any previous session
    await this.usersService.updateSessionToken(user.id, sessionToken);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      // Embed session token in JWT so we can validate it on each request
      sessionToken,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Called by JwtStrategy.validate() on every authenticated request.
   * Checks that the session token in the JWT matches the one stored in DB.
   * If someone else logged in with the same account, their token replaced
   * this one and this request will be rejected.
   */
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
}
