import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpSession } from './otp.entity';
import { OtpService } from './otp.service';
import { AuditLog } from '../audit/audit-log.entity';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AccountPurgeService } from './account-purge.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OtpSession, AuditLog]),
    ConfigModule,
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'change-this-jwt-secret'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '12h') as any,
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, OtpService, AuthRateLimitService, AccountPurgeService],
  controllers: [AuthController],
  exports: [AuthService, OtpService],
})
export class AuthModule {}

