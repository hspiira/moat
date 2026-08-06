import { isTransferTransaction } from "@/lib/domain/transfers";
import type { Account, Counterparty, Transaction } from "@/lib/types";

/**
 * Receivables — money the user has lent out.
 *
 * The unit of interest is a *borrower*, not an account. Every loan lands in one
 * shared pool account — a control account, seeded at bootstrap — and the
 * borrower is a `Counterparty` the transaction points at, so lending to five
 * people creates one account and five subsidiary-ledger entries. A borrower who
 * needs their own ledger can still have a dedicated receivable account, and
 * both shapes report through the same path.
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
  /** Stable grouping key: the dedicated account, or the counterparty. */
  borrowerKey: string;
  counterpartyId?: string;
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
  counterpartyId?: string;
  openingBalance: number;
  transactions: Transaction[];
};

/**
 * A dedicated account is one borrower, so it keys on the account. The pool
 * holds many, so it keys on the counterparty. Rows written before
 * counterparties existed fall back to the payee text they were grouped by.
 */
function bucketFor(
  account: Account,
  transaction: Transaction,
  counterparties: Map<string, Counterparty>,
): { key: string; name: string; counterpartyId?: string } {
  if (account.id !== LENDING_POOL_ACCOUNT_ID) {
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
    counterpartyId: bucket.counterpartyId,
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
  counterparties: Counterparty[] = [],
): LendingPortfolio {
  const byId = new Map(counterparties.map((entry) => [entry.id, entry]));
  const receivables = new Map(
    accounts
      .filter((account) => account.type === "receivable" && !account.isArchived)
      .map((account) => [account.id, account]),
  );

  const buckets = new Map<string, Bucket>();

  // Money owed before Moat was in use, attributed to the person rather than
  // sitting unattributable on the pool. The pool's own opening balance holds
  // the same total, so the two still agree.
  if (receivables.has(LENDING_POOL_ACCOUNT_ID)) {
    for (const counterparty of counterparties) {
      if (!counterparty.openingBalance || counterparty.isArchived) {
        continue;
      }
      buckets.set(`counterparty:${counterparty.id}`, {
        borrowerKey: `counterparty:${counterparty.id}`,
        borrowerName: counterparty.name,
        counterpartyId: counterparty.id,
        openingBalance: counterparty.openingBalance,
        transactions: [],
      });
    }
  }

  // A dedicated account carries its opening balance even with no transactions.
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

    const { key, name, counterpartyId } = bucketFor(account, transaction, byId);
    const existing = buckets.get(key);

    if (existing) {
      existing.transactions.push(transaction);
      continue;
    }

    buckets.set(key, {
      borrowerKey: key,
      borrowerName: name,
      counterpartyId,
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
