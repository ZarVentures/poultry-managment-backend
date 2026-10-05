import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable } from 'rxjs';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { tenantCanAccessApp } from './subscription-access';

const EXEMPT_PREFIXES = [
  '/api/v1/health',
  '/api/health',
  '/api/v1/auth',
  '/api/auth',
  '/api/v1/subscriptions/webhook',
  '/api/v1/subscriptions/create-order',
  '/api/v1/subscriptions/verify',
  '/api/v1/subscriptions/me',
  '/api/subscriptions/webhook',
  '/api/subscriptions/create-order',
  '/api/subscriptions/verify',
  '/api/subscriptions/me',
  '/api/v1/docs',
  '/uploads',
];

@Injectable()
export class SubscriptionGuard implements NestInterceptor {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const path: string = req.path || req.url || '';

    if (EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(p))) {
      return next.handle();
    }

    const tenantId = req.user?.tenantId != null && req.user.tenantId !== ''
      ? String(req.user.tenantId)
      : null;
    if (!tenantId) {
      return next.handle();
    }

    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (tenantCanAccessApp(tenant)) {
      return next.handle();
    }

    throw new ForbiddenException({
      statusCode: 403,
      error: 'SUBSCRIPTION_REQUIRED',
      message: 'Your trial or subscription has ended. Please choose a plan to continue.',
    });
  }
}
