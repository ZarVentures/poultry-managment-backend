export type PaidPlanId = 'starter' | 'professional';
export type BillingPeriod = 'monthly' | 'yearly';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'expired' | 'cancelled';

export const SAAS_PLAN_AMOUNTS_PAISE: Record<PaidPlanId, Record<BillingPeriod, number>> = {
  starter: { monthly: 99_900, yearly: 999_000 },
  professional: { monthly: 249_900, yearly: 2_499_000 },
};

export const SAAS_PLAN_NAMES: Record<PaidPlanId, string> = {
  starter: 'Starter',
  professional: 'Professional',
};

export function isPaidPlan(plan: string): plan is PaidPlanId {
  return plan === 'starter' || plan === 'professional';
}

export function isBillingPeriod(period: string): period is BillingPeriod {
  return period === 'monthly' || period === 'yearly';
}

export function amountPaiseFor(plan: PaidPlanId, period: BillingPeriod): number {
  return SAAS_PLAN_AMOUNTS_PAISE[plan][period];
}
