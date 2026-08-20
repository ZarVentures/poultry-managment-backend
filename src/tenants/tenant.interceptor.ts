import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from './tenant-context.service';

const NO_SHOP_ALLOWLIST = [
  '/api/v1/health',
  '/api/v1/tenants',
  '/api/v1/tenants/me',
  '/api/v1/auth',
];

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const tenantId = req.user?.tenantId ?? null;

    // Authenticated user without a shop yet: only allow setup/profile routes.
    // This prevents a pre-shop user from reading every shop's data.
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

    // Wrap subscription inside the AsyncLocalStorage context so all downstream
    // async work (controllers → services → repositories) sees the tenant id.
    return new Observable((observer) => {
      let isDisposed = false;
      const runResult = this.tenantContext.run(tenantId, () => next.handle());
      runResult.subscribe({
        next: (value) => {
          if (!isDisposed) observer.next(value);
        },
        error: (err) => {
          if (!isDisposed) observer.error(err);
        },
        complete: () => {
          if (!isDisposed) observer.complete();
        },
      });
      return () => {
        isDisposed = true;
      };
    });
  }
}