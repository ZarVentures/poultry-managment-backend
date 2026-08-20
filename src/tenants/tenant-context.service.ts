import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface TenantContext {
  tenantId: string | null;
}

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  run<T>(tenantId: string | null, fn: () => T): T {
    return this.storage.run({ tenantId }, fn);
  }

  getTenantId(): string | null {
    const store = this.storage.getStore();
    return store ? store.tenantId : null;
  }
}