import type { Account, Transaction } from "@/lib/types";

export type DebtSummary = {
  principal: number;
  outstandingBalance: number;
  interestRate: number;
  lenderType?: Account["debtLenderType"];
  monthlyPayment: number;
  estimatedMonthlyInterest: number;
  totalPaid: number;
  estimatedPayoffMonths: number | null;
  estimatedTotalCost: number | null;
};

export function getDebtPayments(account: Account, transactions: Transaction[]) {
  return transactions.filter(
    (transaction) =>
      transaction.accountId === account.id && transaction.type === "debt_payment",
  );
}

export function getDebtSummary(
  account: Account,
  transactions: Transaction[],
): DebtSummary | null {
  if (account.type !== "debt") {
    return null;
  }

  const principal = Math.abs(account.debtPrincipal ?? account.openingBalance ?? 0);
  const interestRate = account.debtInterestRate ?? 0;
  const payments = getDebtPayments(account, transactions);
  const totalPaid = payments.reduce((sum, payment) => sum + Math.abs(payment.amount), 0);
  const outstandingBalance = Math.max(0, Math.abs(account.balance));
  const monthlyPayment = payments.length > 0 ? totalPaid / payments.length : 0;
  const estimatedMonthlyInterest =
    interestRate > 0 ? (outstandingBalance * interestRate) / 100 / 12 : 0;

  let estimatedPayoffMonths: number | null = null;
  if (monthlyPayment > estimatedMonthlyInterest && monthlyPayment > 0) {
    estimatedPayoffMonths = Math.ceil(outstandingBalance / (monthlyPayment - estimatedMonthlyInterest));
  }

  const estimatedTotalCost =
    estimatedPayoffMonths !== null
      ? totalPaid + estimatedPayoffMonths * monthlyPayment
      : null;

  return {
    principal,
    outstandingBalance,
    interestRate,
    lenderType: account.debtLenderType,
    monthlyPayment,
    estimatedMonthlyInterest,
    totalPaid,
    estimatedPayoffMonths,
    estimatedTotalCost,
  };
}
