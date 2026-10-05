import { Tenant } from '../tenants/tenant.entity';

export function tenantCanAccessApp(tenant: Tenant | null | undefined, now = new Date()): boolean {
  if (!tenant) return false;

  const status = (tenant.subscriptionStatus || '').trim().toLowerCase();
  if (!status) return true;

  const periodEnd = tenant.currentPeriodEndsAt ? new Date(tenant.currentPeriodEndsAt) : null;
  const periodActive = !!periodEnd && periodEnd.getTime() > now.getTime();

  if (status === 'active') {
    if (!periodEnd) return true;
    return periodActive;
  }

  if (status === 'trial') {
    if (!tenant.trialEndsAt) return true;
    return new Date(tenant.trialEndsAt).getTime() > now.getTime();
  }

  if (status === 'past_due' || status === 'expired' || status === 'cancelled') {
    return periodActive;
  }

  return false;
}

export function daysUntil(date: Date | string | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  const end = new Date(date).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function addBillingPeriod(from: Date, period: 'monthly' | 'yearly'): Date {
  const next = new Date(from.getTime());
  if (period === 'yearly') {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}
