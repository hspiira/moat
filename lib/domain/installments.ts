import type { PlannedPurchase, TransactionLineItem } from "@/lib/types";

export type InstallmentPayment = {
  lineItemId: string;
  transactionId: string;
  amount: number;
};

export type InstallmentPlan = {
  expected: number;
  paid: number;
  /** Never negative: paying over the agreed price leaves nothing outstanding. */
  remaining: number;
  payments: InstallmentPayment[];
  isSettled: boolean;
  /** Rounded, and capped at 100 so a bar cannot overflow. */
  percentPaid: number;
};

function amountOf(line: TransactionLineItem): number {
  if (line.amount != null) return line.amount;
  if (line.unitPrice != null) return (line.quantity ?? 1) * line.unitPrice;
  return 0;
}

/**
 * What is still owed on a purchase being paid in parts. Payments are the line
 * items pointing back at it, so recording one is an ordinary expense rather
 * than a second kind of record.
 */
export function summariseInstallments(
  purchase: PlannedPurchase,
  lineItems: TransactionLineItem[],
): InstallmentPlan {
  const payments = lineItems
    .filter((line) => line.plannedPurchaseId === purchase.id)
    .map((line) => ({
      lineItemId: line.id,
      transactionId: line.transactionId,
      amount: amountOf(line),
    }))
    .filter((payment) => payment.amount > 0);

  const paid = payments.reduce((total, payment) => total + payment.amount, 0);
  const expected =
    purchase.expectedTotal ??
    (purchase.estimatedUnitPrice != null
      ? (purchase.quantity ?? 1) * purchase.estimatedUnitPrice
      : paid);

  return {
    expected,
    paid,
    remaining: Math.max(0, expected - paid),
    payments,
    isSettled: expected > 0 && paid >= expected,
    percentPaid: expected > 0 ? Math.min(100, Math.round((paid / expected) * 100)) : 0,
  };
}

/** Whether a purchase is being paid off rather than bought outright. */
export function isInstallmentPurchase(purchase: PlannedPurchase): boolean {
  return purchase.expectedTotal != null && purchase.expectedTotal > 0;
}
