import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DataSource } from 'typeorm';
import { TenantContextService } from './tenant-context.service';

const NO_SHOP_ALLOWLIST = [
  '/api/v1/health',
  '/api/v1/tenants',
  '/api/v1/tenants/me',
  '/api/v1/auth',
  '/api/health',
  '/api/tenants',
  '/api/tenants/me',
  '/api/auth',
];

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly dataSource: DataSource,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    let tenantId =
      req.user?.tenantId != null && req.user.tenantId !== ''
        ? String(req.user.tenantId)
        : null;

    if (!tenantId && req.user?.userId) {
      try {
        const rows = await this.dataSource.query(
          `SELECT tenant_id FROM users WHERE id = $1 LIMIT 1`,
          [String(req.user.userId)],
        );
        if (rows?.[0]?.tenant_id != null) {
          tenantId = String(rows[0].tenant_id);
          req.user.tenantId = tenantId;
        }
      } catch {
        // service-level checks still apply
      }
    }

    if (req.user && !tenantId) {
      const path: string = req.path || req.url || '';
      const allowed = NO_SHOP_ALLOWLIST.some(
        (p) => path === p || path.startsWith(`${p}/`),
      );
      if (!allowed) {
        throw new ForbiddenException(
          'Create your business shop first to access this data.',
        );
      }
    }

    const tid = tenantId == null || tenantId === '' ? null : String(tenantId);
    return new Observable((observer) => {
      return this.tenantContext.run(tid, () =>
        next.handle().subscribe({
          next: (value) => observer.next(value),
          error: (err) => observer.error(err),
          complete: () => observer.complete(),
        }),
      );
    });
  }
}
