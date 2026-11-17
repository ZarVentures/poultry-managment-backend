export type AutoPaymentStatus = 'paid' | 'pending' | 'partial';

/** Derive sale payment status from due vs received. */
export function derivePaymentStatus(dueAmount: number, paidAmount: number): AutoPaymentStatus {
  const due = Math.round((Number(dueAmount) || 0) * 100) / 100;
  const paid = Math.round((Number(paidAmount) || 0) * 100) / 100;
  if (paid <= 0) return 'pending';
  if (due <= 0) return 'paid';
  if (paid + 0.001 >= due) return 'paid';
  return 'partial';
}

/** Extra cash above the bill becomes customer advance in the ledger. */
export function advanceFromOverpayment(dueAmount: number, paidAmount: number): number {
  const due = Math.round((Number(dueAmount) || 0) * 100) / 100;
  const paid = Math.round((Number(paidAmount) || 0) * 100) / 100;
  return Math.max(0, Math.round((paid - due) * 100) / 100);
}
