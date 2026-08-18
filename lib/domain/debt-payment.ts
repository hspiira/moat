import type { Account, Transaction } from "@/lib/types";

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

export function lastLoanPaymentOn(loanId: string, transactions: Transaction[]): string | null {
  return (
    transactions
      .filter(
        (transaction) =>
          transaction.accountId === loanId &&
          (transaction.type === "transfer" || transaction.type === "debt_payment"),
      )
      .map((transaction) => transaction.occurredOn)
      .sort()
      .at(-1) ?? null
  );
}

export function accruedLoanInterest(params: {
  account: Account;
  occurredOn: string;
  previousPaymentOn?: string | null;
}): number {
  const { account, occurredOn, previousPaymentOn } = params;

  if (account.type !== "debt") {
    return 0;
  }

  const rate = account.debtInterestRate ?? 0;
  const outstanding = Math.max(0, -account.balance);

  const accrueFrom = previousPaymentOn ?? account.debtStartDate ?? null;
  const days = accrueFrom === null ? 0 : elapsedDays(accrueFrom, occurredOn);

  const interestBase =
    account.debtInterestModel === "flat"
      ? Math.abs(account.debtPrincipal ?? outstanding)
      : outstanding;

  return rate <= 0 || interestBase <= 0 || days <= 0
    ? 0
    : Math.round((interestBase * (rate / 100) * days) / DAYS_PER_YEAR);
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
  const outstanding = Math.max(0, -account.balance);
  const accruedInterest = accruedLoanInterest({ account, occurredOn, previousPaymentOn });

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
