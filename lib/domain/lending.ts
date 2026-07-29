import { isTransferTransaction } from "@/lib/domain/transfers";
import type { Account, Transaction } from "@/lib/types";

/**
 * Receivables — money the user has lent out.
 *
 * The unit of interest is a *borrower*, not an account. By default every loan
 * lands in one shared pool account and the borrower is carried in the
 * transaction's `payee`, so lending to five people does not create five
 * accounts. A borrower who needs their own ledger can be given a dedicated
 * receivable account instead, and both shapes report through the same path.
 *
 * This is the mirror of `debt.ts` in subject only. None of the borrowing
 * machinery applies: the user does not control when a borrower repays, so
 * there is deliberately no interest model, no inferred minimum payment, and no
 * payoff strategy. A due date exists only when the user states one.
 */

export const LENDING_POOL_ACCOUNT_ID = "account:money-lent-out";
export const LENDING_POOL_ACCOUNT_NAME = "Money lent out";
const UNNAMED_BORROWER = "Unnamed borrower";

const BALANCE_EPSILON = 0.01;
const MILLISECONDS_PER_DAY = 86_400_000;

export type ReceivableStatus = "outstanding" | "settled" | "written_off" | "overpaid";

export type BorrowerLoans = {
  /** Stable grouping key: the dedicated account, or the payee within the pool. */
  borrowerKey: string;
  borrowerName: string;
  /** Set only when the borrower has their own account rather than the pool. */
  accountId?: string;
  amountLent: number;
  amountRepaid: number;
  amountWrittenOff: number;
  /** Signed. Negative means the borrower repaid more than they owed. */
  outstanding: number;
  lentOn: string | null;
  lastRepaymentOn: string | null;
  /** The soonest date the user agreed to, across this borrower's loans. */
  expectedRepaymentDate?: string;
  isOverdue: boolean;
  status: ReceivableStatus;
  daysSinceLastActivity: number;
};

export type LendingPortfolio = {
  totalLent: number;
  totalRepaid: number;
  totalWrittenOff: number;
  totalOutstanding: number;
  /** Borrowers with any activity, overdue first, then largest outstanding. */
  borrowers: BorrowerLoans[];
};

export function buildLendingPoolAccount(userId: string, timestamp: string): Account {
  return {
    id: LENDING_POOL_ACCOUNT_ID,
    userId,
    name: LENDING_POOL_ACCOUNT_NAME,
    type: "receivable",
    openingBalance: 0,
    balance: 0,
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * The pool is created the first time money is lent into it rather than seeded
 * for everyone, so people who never lend never see a lending account. Returns
 * the account to create, or null when nothing is needed.
 */
export function ensureLendingPool(
  accounts: Account[],
  destinationAccountId: string,
  userId: string,
  timestamp: string,
): Account | null {
  if (destinationAccountId !== LENDING_POOL_ACCOUNT_ID) {
    return null;
  }
  if (accounts.some((account) => account.id === LENDING_POOL_ACCOUNT_ID)) {
    return null;
  }

  return buildLendingPoolAccount(userId, timestamp);
}

/**
 * Day number in UTC. Both sides of every date comparison go through this, so
 * results never depend on the machine's timezone.
 */
function toUtcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function isoDateToUtcDay(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function deriveStatus(outstanding: number, amountWrittenOff: number): ReceivableStatus {
  if (outstanding < -BALANCE_EPSILON) {
    return "overpaid";
  }
  if (Math.abs(outstanding) <= BALANCE_EPSILON) {
    return amountWrittenOff > 0 ? "written_off" : "settled";
  }
  return "outstanding";
}

type Bucket = {
  borrowerKey: string;
  borrowerName: string;
  accountId?: string;
  openingBalance: number;
  transactions: Transaction[];
};

/**
 * A dedicated account is one borrower, so it keys on the account. The pool
 * holds many, so it keys on the payee — trimmed and lowercased, since the same
 * person gets typed differently across months.
 */
function bucketFor(account: Account, transaction: Transaction): { key: string; name: string } {
  if (account.id !== LENDING_POOL_ACCOUNT_ID) {
    return { key: `account:${account.id}`, name: account.name };
  }

  const payee = transaction.payee?.trim();
  if (!payee) {
    return { key: "payee:", name: UNNAMED_BORROWER };
  }

  return { key: `payee:${payee.toLowerCase()}`, name: payee };
}

function summarise(bucket: Bucket, asOf: Date): BorrowerLoans {
  let amountLent = Math.max(0, bucket.openingBalance);
  let amountRepaid = 0;
  let amountWrittenOff = 0;
  let lentOn: string | null = null;
  let lastRepaymentOn: string | null = null;
  let lastActivityOn: string | null = null;
  let expectedRepaymentDate: string | undefined;

  for (const transaction of bucket.transactions) {
    const magnitude = Math.abs(transaction.amount);

    if (transaction.type === "expense") {
      amountWrittenOff += magnitude;
    } else if (transaction.amount > 0) {
      amountLent += magnitude;
      if (lentOn === null || transaction.occurredOn < lentOn) {
        lentOn = transaction.occurredOn;
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

  const outstanding = amountLent - amountRepaid - amountWrittenOff;
  const status = deriveStatus(outstanding, amountWrittenOff);

  return {
    borrowerKey: bucket.borrowerKey,
    borrowerName: bucket.borrowerName,
    accountId: bucket.accountId,
    amountLent,
    amountRepaid,
    amountWrittenOff,
    outstanding,
    lentOn,
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

export function getLendingPortfolio(
  accounts: Account[],
  transactions: Transaction[],
  asOf: Date,
): LendingPortfolio {
  const receivables = new Map(
    accounts
      .filter((account) => account.type === "receivable" && !account.isArchived)
      .map((account) => [account.id, account]),
  );

  const buckets = new Map<string, Bucket>();

  // A dedicated account carries its opening balance even with no transactions;
  // the pool cannot attribute one to any borrower, so it never has one.
  for (const account of receivables.values()) {
    if (account.id === LENDING_POOL_ACCOUNT_ID || account.openingBalance <= 0) {
      continue;
    }
    buckets.set(`account:${account.id}`, {
      borrowerKey: `account:${account.id}`,
      borrowerName: account.name,
      accountId: account.id,
      openingBalance: account.openingBalance,
      transactions: [],
    });
  }

  for (const transaction of transactions) {
    const account = receivables.get(transaction.accountId);
    if (!account) {
      continue;
    }
    // Only transfer legs and write-off expenses describe a loan.
    if (!isTransferTransaction(transaction) && transaction.type !== "expense") {
      continue;
    }

    const { key, name } = bucketFor(account, transaction);
    const existing = buckets.get(key);

    if (existing) {
      existing.transactions.push(transaction);
      continue;
    }

    buckets.set(key, {
      borrowerKey: key,
      borrowerName: name,
      accountId: account.id === LENDING_POOL_ACCOUNT_ID ? undefined : account.id,
      openingBalance: account.id === LENDING_POOL_ACCOUNT_ID ? 0 : account.openingBalance,
      transactions: [transaction],
    });
  }

  const borrowers = [...buckets.values()]
    .map((bucket) => summarise(bucket, asOf))
    .sort((left, right) => {
      if (left.isOverdue !== right.isOverdue) {
        return left.isOverdue ? -1 : 1;
      }
      if (left.outstanding !== right.outstanding) {
        return right.outstanding - left.outstanding;
      }
      return left.borrowerName.localeCompare(right.borrowerName);
    });

  return {
    totalLent: borrowers.reduce((total, borrower) => total + borrower.amountLent, 0),
    totalRepaid: borrowers.reduce((total, borrower) => total + borrower.amountRepaid, 0),
    totalWrittenOff: borrowers.reduce((total, borrower) => total + borrower.amountWrittenOff, 0),
    totalOutstanding: borrowers.reduce((total, borrower) => total + borrower.outstanding, 0),
    borrowers,
  };
}
