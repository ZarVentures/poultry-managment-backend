import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Tenant } from './tenant.entity';
import { Settings } from '../settings/settings.entity';
import { RolePermission } from '../permissions/entities/role-permission.entity';
import { TenantContextService } from './tenant-context.service';
import { TenantInterceptor } from './tenant.interceptor';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Settings, RolePermission]), UsersModule, AuthModule],
  controllers: [TenantsController],
  providers: [
    TenantContextService,
    TenantsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
  exports: [TenantContextService, TenantsService, TypeOrmModule],
})
export class TenantsModule {}