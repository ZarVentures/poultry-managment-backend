export function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isWithinRecoveryWindow(
  user: {
    deletedAt?: Date | string | null;
    purgedAt?: Date | string | null;
    recoveryExpiresAt?: Date | string | null;
  },
  now = new Date(),
): boolean {
  if (asDate(user.purgedAt)) return false;
  if (!asDate(user.deletedAt)) return false;
  const expires = asDate(user.recoveryExpiresAt);
  if (!expires) return false;
  return expires.getTime() > now.getTime();
}

/** Admin with no other active admin closes the whole organization. */
export function shouldDeleteOrganization(input: {
  role?: string | null;
  otherActiveAdmins: number;
}): boolean {
  const role = (input.role || '').trim().toLowerCase();
  if (role !== 'admin') return false;
  return input.otherActiveAdmins === 0;
}
