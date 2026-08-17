import { reconcileDefaultAccounts } from "@/lib/app-state/default-accounts";
import { reconcileDefaultCategories } from "@/lib/app-state/defaults";
import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { findTransactionTypeDrift } from "@/lib/domain/transaction-type-drift";
import { repositories } from "@/lib/repositories/instance";
import type {
  Account,
  BudgetTarget,
  CaptureReviewItem,
  Category,
  MonthClose,
  RecurringObligation,
  SyncOutboxItem,
  SyncProfile,
  Transaction,
  TransactionLineItem,
  TransactionRule,
} from "@/lib/types";

export type WorkspaceSnapshot = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  lineItems: TransactionLineItem[];
  budgets: BudgetTarget[];
  captureReviewItems: CaptureReviewItem[];
  transactionRules: TransactionRule[];
  recurringObligations: RecurringObligation[];
  monthClose: MonthClose | null;
  pendingSyncTransactionIds: Set<string>;
};

export type WorkspaceSnapshotOptions = {
  userId: string;
  closePeriod: string;
  timestamp: string;
  backfillCounterparties: (userId: string, transactions: Transaction[]) => Promise<Transaction[]>;
};

/** Transactions the hosted sync has not yet accepted. */
export function pendingSyncTransactionIds(
  syncProfile: SyncProfile | null | undefined,
  outbox: SyncOutboxItem[],
): Set<string> {
  if (!syncProfile?.hostedSyncEnabled || syncProfile.mode !== "hosted_opt_in") {
    return new Set();
  }
  return new Set(
    outbox
      .filter(
        (item) =>
          item.entityType === "transaction" &&
          (item.status === "pending" || item.status === "failed"),
      )
      .map((item) => item.entityId),
  );
}

/**
 * Reads the workspace and repairs what it finds on the way through: missing
 * seeded accounts and categories, and rows whose type their category no longer
 * permits. Balances are reconciled for display only, since loading is a read.
 */
export async function loadWorkspaceSnapshot(
  options: WorkspaceSnapshotOptions,
): Promise<WorkspaceSnapshot> {
  const { userId, closePeriod, timestamp, backfillCounterparties } = options;

  const [storedAccounts, storedCategories, storedTransactions, lineItems] = await Promise.all([
    repositories.accounts.listByUser(userId),
    repositories.categories.listByUser(userId),
    repositories.transactions.listByUser(userId),
    repositories.transactionLineItems.listByUser(userId),
  ]);
  const [
    captureReviewItems,
    transactionRules,
    recurringObligations,
    monthClose,
    budgets,
    syncProfile,
    outbox,
  ] = await Promise.all([
    repositories.captureReviewItems.listByUser(userId),
    repositories.transactionRules.listByUser(userId),
    repositories.recurringObligations.listByUser(userId),
    repositories.monthCloses.getByPeriod(userId, closePeriod),
    repositories.budgets.listByMonth(userId, closePeriod),
    repositories.syncProfiles.getByUser(userId),
    repositories.syncOutbox.listByUser(userId),
  ]);

  const accounts = await repairAccounts(storedAccounts, storedTransactions, userId, timestamp);
  const categories = await repairCategories(storedCategories, userId);
  const backfilled = await backfillCounterparties(userId, storedTransactions);
  const transactions = await repairTypeDrift(backfilled, categories, timestamp);

  return {
    accounts,
    categories,
    transactions,
    lineItems,
    budgets,
    captureReviewItems,
    transactionRules,
    recurringObligations,
    monthClose,
    pendingSyncTransactionIds: pendingSyncTransactionIds(syncProfile, outbox),
  };
}

async function repairAccounts(
  stored: Account[],
  transactions: Transaction[],
  userId: string,
  timestamp: string,
): Promise<Account[]> {
  const seeds = reconcileDefaultAccounts(stored, userId, timestamp);
  if (seeds.length > 0) {
    await Promise.all(seeds.map((account) => repositories.accounts.upsert(account)));
  }
  return reconcileAccountBalances([...stored, ...seeds], transactions);
}

// A stale kind is not cosmetic: "Debt repayment" seeded as an expense leaves a
// debt payment with no valid category at all. Returns nothing once a device is
// current, so this is a one-off write rather than churn on every load.
async function repairCategories(stored: Category[], userId: string): Promise<Category[]> {
  const fixes = reconcileDefaultCategories(stored, userId);
  if (fixes.length === 0) return stored;
  await Promise.all(fixes.map((category) => repositories.categories.upsert(category)));
  return repositories.categories.listByUser(userId);
}

// Rows left carrying a type their category no longer permits are rejected on save.
async function repairTypeDrift(
  transactions: Transaction[],
  categories: Category[],
  timestamp: string,
): Promise<Transaction[]> {
  const drift = findTransactionTypeDrift(transactions, categories, timestamp);

  if (drift.repaired.length > 0) {
    await Promise.all(drift.repaired.map((entry) => repositories.transactions.upsert(entry)));
  }
  if (drift.needsReview.length > 0) {
    console.warn(
      `Moat: ${drift.needsReview.length} transaction(s) have a category their type cannot use and need a manual fix.`,
      drift.needsReview.map((entry) => entry.id),
    );
  }

  const repaired = new Map(drift.repaired.map((entry) => [entry.id, entry]));
  return transactions.map((entry) => repaired.get(entry.id) ?? entry);
}
