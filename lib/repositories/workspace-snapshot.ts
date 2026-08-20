import { reconcileDefaultAccounts } from "@/lib/app-state/default-accounts";
import { reconcileDefaultCategories } from "@/lib/app-state/defaults";
import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { planCategoryMerge } from "@/lib/domain/category-merge";
import { countCategoryUsage } from "@/lib/domain/category-usage";
import { findTransactionTypeDrift } from "@/lib/domain/transaction-type-drift";
import { applyCategoryMerge } from "@/lib/repositories/category-references";
import { repositories } from "@/lib/repositories/instance";
import { repairMoneyDrift } from "@/lib/repositories/money-drift-repair";
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
  Project,
} from "@/lib/types";

export type WorkspaceSnapshot = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  lineItems: TransactionLineItem[];
  projects: Project[];
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

export async function loadWorkspaceSnapshot(
  options: WorkspaceSnapshotOptions,
): Promise<WorkspaceSnapshot> {
  const { userId, closePeriod, timestamp, backfillCounterparties } = options;

  await repairMoneyDrift(userId, timestamp);

  const [storedAccounts, storedCategories, storedTransactions, lineItems, projects] =
    await Promise.all([
      repositories.accounts.listByUser(userId),
      repositories.categories.listByUser(userId),
      repositories.transactions.listByUser(userId),
      repositories.transactionLineItems.listByUser(userId),
      repositories.projects.listByUser(userId),
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
  const repair = await repairCategories(storedCategories, storedTransactions, userId, timestamp);
  const categories = repair.categories;

  const [refiledTransactions, refiledLineItems] = repair.merged
    ? await Promise.all([
        repositories.transactions.listByUser(userId),
        repositories.transactionLineItems.listByUser(userId),
      ])
    : [storedTransactions, lineItems];

  const backfilled = await backfillCounterparties(userId, refiledTransactions);
  const transactions = await repairTypeDrift(backfilled, categories, timestamp);

  return {
    accounts,
    categories,
    transactions,
    lineItems: refiledLineItems,
    projects,
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

type CategoryRepair = {
  categories: Category[];
  merged: boolean;
};

async function repairCategories(
  stored: Category[],
  transactions: Transaction[],
  userId: string,
  timestamp: string,
): Promise<CategoryRepair> {
  const fixes = reconcileDefaultCategories(stored, userId);
  if (fixes.length > 0) {
    await Promise.all(fixes.map((category) => repositories.categories.upsert(category)));
  }

  const current =
    fixes.length > 0 ? await repositories.categories.listByUser(userId) : stored;

  const plan = planCategoryMerge(current, countCategoryUsage(transactions));
  if (plan.removedIds.length === 0) {
    return { categories: current, merged: false };
  }

  await applyCategoryMerge({ userId, plan, timestamp });
  console.warn(
    `Moat: folded ${plan.removedIds.length} duplicate categor${plan.removedIds.length === 1 ? "y" : "ies"} into the copy that was already in use.`,
    plan.removedIds,
  );

  return { categories: await repositories.categories.listByUser(userId), merged: true };
}

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
