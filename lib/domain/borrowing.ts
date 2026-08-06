import { isTransferTransaction } from "@/lib/domain/transfers";
import type { Account, Counterparty, Transaction } from "@/lib/types";

/**
 * Informal borrowing, grouped by lender. The mirror of `lending.ts`, and kept
 * separate from `debt.ts` because an informal loan has no rate or term to
 * amortise — projecting one would invent a schedule nobody agreed to.
 *
 * The pool is a control account; each lender is a `Counterparty`.
 *
 * Sign convention on a debt account: the balance is negative while money is
 * owed, so a negative transfer leg is borrowing and a positive leg is
 * repayment. Debt forgiven is `income`, the mirror of a write-off being an
 * expense on a receivable.
 */

export const BORROWING_POOL_ACCOUNT_ID = "account:money-borrowed";
export const BORROWING_POOL_ACCOUNT_NAME = "Money borrowed";
const UNNAMED_LENDER = "Unnamed lender";

const BALANCE_EPSILON = 0.01;
const MILLISECONDS_PER_DAY = 86_400_000;

export type PayableStatus = "outstanding" | "settled" | "forgiven" | "overpaid";

export type LenderLoans = {
  lenderKey: string;
  counterpartyId?: string;
  lenderName: string;
  accountId?: string;
  amountBorrowed: number;
  amountRepaid: number;
  amountForgiven: number;
  /** Signed. Negative means the user repaid more than they owed. */
  outstanding: number;
  borrowedOn: string | null;
  lastRepaymentOn: string | null;
  expectedRepaymentDate?: string;
  isOverdue: boolean;
  status: PayableStatus;
  daysSinceLastActivity: number;
};

export type BorrowingPortfolio = {
  totalBorrowed: number;
  totalRepaid: number;
  totalForgiven: number;
  totalOutstanding: number;
  lenders: LenderLoans[];
};

export function buildBorrowingPoolAccount(userId: string, timestamp: string): Account {
  return {
    id: BORROWING_POOL_ACCOUNT_ID,
    userId,
    name: BORROWING_POOL_ACCOUNT_NAME,
    type: "debt",
    openingBalance: 0,
    balance: 0,
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function toUtcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function isoDateToUtcDay(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function deriveStatus(outstanding: number, amountForgiven: number): PayableStatus {
  if (outstanding < -BALANCE_EPSILON) {
    return "overpaid";
  }
  if (Math.abs(outstanding) <= BALANCE_EPSILON) {
    return amountForgiven > 0 ? "forgiven" : "settled";
  }
  return "outstanding";
}

type Bucket = {
  lenderKey: string;
  lenderName: string;
  accountId?: string;
  counterpartyId?: string;
  openingBalance: number;
  transactions: Transaction[];
};

/** Rows written before counterparties existed fall back to the payee text. */
function bucketFor(
  account: Account,
  transaction: Transaction,
  counterparties: Map<string, Counterparty>,
): { key: string; name: string; counterpartyId?: string } {
  if (account.id !== BORROWING_POOL_ACCOUNT_ID) {
    return { key: `account:${account.id}`, name: account.name };
  }

  const counterparty = transaction.counterpartyId
    ? counterparties.get(transaction.counterpartyId)
    : undefined;
  if (counterparty) {
    return {
      key: `counterparty:${counterparty.id}`,
      name: counterparty.name,
      counterpartyId: counterparty.id,
    };
  }

  const payee = transaction.payee?.trim();
  if (!payee) {
    return { key: "payee:", name: UNNAMED_LENDER };
  }

  return { key: `payee:${payee.toLowerCase()}`, name: payee };
}

function summarise(bucket: Bucket, asOf: Date): LenderLoans {
  let amountBorrowed = Math.max(0, -bucket.openingBalance);
  let amountRepaid = 0;
  let amountForgiven = 0;
  let borrowedOn: string | null = null;
  let lastRepaymentOn: string | null = null;
  let lastActivityOn: string | null = null;
  let expectedRepaymentDate: string | undefined;

  for (const transaction of bucket.transactions) {
    const magnitude = Math.abs(transaction.amount);

    if (transaction.type === "income") {
      amountForgiven += magnitude;
    } else if (transaction.amount < 0) {
      amountBorrowed += magnitude;
      if (borrowedOn === null || transaction.occurredOn < borrowedOn) {
        borrowedOn = transaction.occurredOn;
      }
      const due = transaction.expectedRepaymentDate;
      if (due && (expectedRepaymentDate === undefined || due < expectedRepaymentDate)) {
        expectedRepaymentDate = due;
      }
    } else {
      amountRepaid += magnitude;
      if (lastRepaymentOn === null || transaction.occurredOn > lastRepaymentOn) {
        lastRepaymentOn = transaction.occurredOn;
      }
    }

    if (lastActivityOn === null || transaction.occurredOn > lastActivityOn) {
      lastActivityOn = transaction.occurredOn;
    }
  }

  const outstanding = amountBorrowed - amountRepaid - amountForgiven;
  const status = deriveStatus(outstanding, amountForgiven);

  return {
    lenderKey: bucket.lenderKey,
    lenderName: bucket.lenderName,
    accountId: bucket.accountId,
    counterpartyId: bucket.counterpartyId,
    amountBorrowed,
    amountRepaid,
    amountForgiven,
    outstanding,
    borrowedOn,
    lastRepaymentOn,
    expectedRepaymentDate,
    isOverdue:
      status === "outstanding" &&
      expectedRepaymentDate !== undefined &&
      toUtcDay(asOf) > isoDateToUtcDay(expectedRepaymentDate),
    status,
    daysSinceLastActivity:
      lastActivityOn === null
        ? 0
        : Math.max(
            0,
            Math.floor((toUtcDay(asOf) - isoDateToUtcDay(lastActivityOn)) / MILLISECONDS_PER_DAY),
          ),
  };
}

export function isInformalDebt(account: Account): boolean {
  if (account.type !== "debt") {
    return false;
  }
  if (account.id === BORROWING_POOL_ACCOUNT_ID) {
    return true;
  }

  return !account.debtInterestRate && !account.debtTermMonths && !account.debtPrincipal;
}

export function getBorrowingPortfolio(
  accounts: Account[],
  transactions: Transaction[],
  asOf: Date,
  counterparties: Counterparty[] = [],
): BorrowingPortfolio {
  const byId = new Map(counterparties.map((entry) => [entry.id, entry]));
  const payables = new Map(
    accounts
      .filter((account) => isInformalDebt(account) && !account.isArchived)
      .map((account) => [account.id, account]),
  );

  const buckets = new Map<string, Bucket>();

  if (payables.has(BORROWING_POOL_ACCOUNT_ID)) {
    for (const counterparty of counterparties) {
      if (!counterparty.openingBalance || counterparty.isArchived) {
        continue;
      }
      buckets.set(`counterparty:${counterparty.id}`, {
        lenderKey: `counterparty:${counterparty.id}`,
        lenderName: counterparty.name,
        counterpartyId: counterparty.id,
        openingBalance: -counterparty.openingBalance,
        transactions: [],
      });
    }
  }

  for (const account of payables.values()) {
    if (account.id === BORROWING_POOL_ACCOUNT_ID || account.openingBalance >= 0) {
      continue;
    }
    buckets.set(`account:${account.id}`, {
      lenderKey: `account:${account.id}`,
      lenderName: account.name,
      accountId: account.id,
      openingBalance: account.openingBalance,
      transactions: [],
    });
  }

  for (const transaction of transactions) {
    const account = payables.get(transaction.accountId);
    if (!account) {
      continue;
    }
    // Legacy `debt_payment` rows are excluded: they predate the interest split
    // and are already reported by `getDebtSummary`.
    if (!isTransferTransaction(transaction) && transaction.type !== "income") {
      continue;
    }

    const { key, name, counterpartyId } = bucketFor(account, transaction, byId);
    const existing = buckets.get(key);

    if (existing) {
      existing.transactions.push(transaction);
      continue;
    }

    buckets.set(key, {
      lenderKey: key,
      lenderName: name,
      counterpartyId,
      accountId: account.id === BORROWING_POOL_ACCOUNT_ID ? undefined : account.id,
      openingBalance: account.id === BORROWING_POOL_ACCOUNT_ID ? 0 : account.openingBalance,
      transactions: [transaction],
    });
  }

  const lenders = [...buckets.values()]
    .map((bucket) => summarise(bucket, asOf))
    .sort((left, right) => {
      if (left.isOverdue !== right.isOverdue) {
        return left.isOverdue ? -1 : 1;
      }
      if (left.outstanding !== right.outstanding) {
        return right.outstanding - left.outstanding;
      }
      return left.lenderName.localeCompare(right.lenderName);
    });

  return {
    totalBorrowed: lenders.reduce((total, lender) => total + lender.amountBorrowed, 0),
    totalRepaid: lenders.reduce((total, lender) => total + lender.amountRepaid, 0),
    totalForgiven: lenders.reduce((total, lender) => total + lender.amountForgiven, 0),
    totalOutstanding: lenders.reduce((total, lender) => total + lender.outstanding, 0),
    lenders,
  };
}
