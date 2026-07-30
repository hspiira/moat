import type { Account } from "@/lib/types";

/**
 * Splitting a loan payment into its interest and principal parts.
 *
 * A payment is not one thing. The interest is a real cost — it leaves the
 * household and never comes back, so it is spending and it reduces net worth.
 * The principal is a balance-sheet move: cash falls and the liability falls with
 * it, leaving net worth unchanged. Recording the whole payment as an expense
 * overstates spending; recording it all as a transfer hides a genuine cost.
 *
 * Nothing here asks the user for anything. The rate, model, balance, and start
 * date already live on the account, so the split is derived.
 *
 * Interest accrues daily on an actual/365 basis, because what matters is the
 * time actually elapsed since the last payment. `debt.ts` computes a *monthly*
 * interest figure from the same fields for its payoff projection, which steps in
 * whole months — the two agree over a month and are used for different jobs.
 */

const DAYS_PER_YEAR = 365;
const MILLISECONDS_PER_DAY = 86_400_000;

export type DebtPaymentSplit = {
  /** The part that is a genuine cost. Spending; reduces net worth. */
  interest: number;
  /** The part that retires debt. Net worth unchanged. */
  principal: number;
  /** Anything paid beyond what was still owed. */
  overpayment: number;
  /** What had accrued before the payment was capped against it. */
  accruedInterest: number;
  /** False when the payment did not even cover interest, so the debt grew. */
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
  /** The previous payment against this loan, if there has been one. */
  previousPaymentOn?: string | null;
}): DebtPaymentSplit | null {
  const { account, paymentAmount, occurredOn, previousPaymentOn } = params;

  if (account.type !== "debt") {
    return null;
  }

  const payment = Math.abs(paymentAmount);
  const rate = account.debtInterestRate ?? 0;
  const outstanding = Math.max(0, -account.balance);

  // With no prior payment and no start date there is nothing to measure a
  // period against. Assuming one would invent a cost the user never agreed to.
  const accrueFrom = previousPaymentOn ?? account.debtStartDate ?? null;
  const days = accrueFrom === null ? 0 : elapsedDays(accrueFrom, occurredOn);

  // Flat-rate loans charge on the original principal for the whole term, which
  // is why they cost more than the headline rate suggests.
  const interestBase =
    account.debtInterestModel === "flat"
      ? Math.abs(account.debtPrincipal ?? outstanding)
      : outstanding;

  const accruedInterest =
    rate <= 0 || interestBase <= 0 || days <= 0
      ? 0
      : Math.round((interestBase * (rate / 100) * days) / DAYS_PER_YEAR);

  // Interest is taken first: a payment that cannot cover it retires no
  // principal at all, and the loan grows.
  const interest = Math.min(payment, accruedInterest);
  const towardsPrincipal = payment - interest;
  const principal = Math.min(towardsPrincipal, outstanding);

  return {
    interest,
    principal,
    // Whatever is left once interest and the remaining balance are covered.
    // Derived by subtraction so the three parts always re-add to the payment
    // exactly, however the interest rounded.
    overpayment: towardsPrincipal - principal,
    accruedInterest,
    coversInterest: payment >= accruedInterest,
  };
}
