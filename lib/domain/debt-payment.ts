import type { Account } from "@/lib/types";

const DAYS_PER_YEAR = 365;
const MILLISECONDS_PER_DAY = 86_400_000;

export type DebtPaymentSplit = {
  interest: number;
  principal: number;
  overpayment: number;
  accruedInterest: number;
  coversInterest: boolean;
};

function isoDateToUtcMillis(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function elapsedDays(from: string, to: string): number {
  return Math.max(0, (isoDateToUtcMillis(to) - isoDateToUtcMillis(from)) / MILLISECONDS_PER_DAY);
}

export function splitDebtPayment(params: {
  account: Account;
  paymentAmount: number;
  occurredOn: string;
  previousPaymentOn?: string | null;
}): DebtPaymentSplit | null {
  const { account, paymentAmount, occurredOn, previousPaymentOn } = params;

  if (account.type !== "debt") {
    return null;
  }

  const payment = Math.abs(paymentAmount);
  const rate = account.debtInterestRate ?? 0;
  const outstanding = Math.max(0, -account.balance);

  const accrueFrom = previousPaymentOn ?? account.debtStartDate ?? null;
  const days = accrueFrom === null ? 0 : elapsedDays(accrueFrom, occurredOn);

  const interestBase =
    account.debtInterestModel === "flat"
      ? Math.abs(account.debtPrincipal ?? outstanding)
      : outstanding;

  const accruedInterest =
    rate <= 0 || interestBase <= 0 || days <= 0
      ? 0
      : Math.round((interestBase * (rate / 100) * days) / DAYS_PER_YEAR);

  const interest = Math.min(payment, accruedInterest);
  const towardsPrincipal = payment - interest;
  const principal = Math.min(towardsPrincipal, outstanding);

  return {
    interest,
    principal,
    overpayment: towardsPrincipal - principal,
    accruedInterest,
    coversInterest: payment >= accruedInterest,
  };
}
