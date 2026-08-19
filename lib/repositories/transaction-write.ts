import { ensureFeesCategory } from "@/lib/app-state/defaults";
import { planLineItemCascade } from "@/lib/domain/line-item-cascade";
import { planTransactionCascade } from "@/lib/domain/transaction-cascade";
import type { TransactionWritePlan } from "@/lib/domain/transaction-write-plan";
import { repositories } from "@/lib/repositories/instance";
import type { Category, Transaction } from "@/lib/types";

type TransactionSnapshot = ReadonlyArray<readonly [string, Transaction | null]>;

async function snapshotTransactions(ids: string[]): Promise<TransactionSnapshot> {
  return Promise.all(
    ids.map(async (id) => [id, await repositories.transactions.getById(id)] as const),
  );
}

async function restoreTransactions(snapshot: TransactionSnapshot): Promise<void> {
  for (const [id, before] of snapshot) {
    if (before) {
      await repositories.transactions.upsert(before);
    } else {
      await repositories.transactions.remove(id);
    }
  }
}

export async function applyTransactionWrite(
  plan: TransactionWritePlan,
  categories: Category[],
  userId: string,
): Promise<void> {
  const rows = plan.fee ? [...plan.rows, plan.fee] : plan.rows;
  const snapshot = await snapshotTransactions([
    ...rows.map((row) => row.id),
    ...plan.staleIds,
  ]);

  try {
    if (plan.fee) {
      const feesCategory = ensureFeesCategory(categories, userId);
      if (feesCategory) {
        await repositories.categories.upsert(feesCategory);
      }
    }

    for (const row of rows) {
      await repositories.transactions.upsert(row);
    }

    for (const id of plan.staleIds) {
      await repositories.transactions.remove(id);
    }
  } catch (error) {
    try {
      await restoreTransactions(snapshot);
    } catch {
      // A rollback that cannot write leaves the original failure as the one worth reporting.
    }
    throw error;
  }
}

export async function applyTransactionDelete(
  transaction: Transaction,
  transactions: Transaction[],
  userId: string,
  timestamp: string,
): Promise<Set<string>> {
  const idsToRemove = planTransactionCascade(transaction, transactions);
  const [lineItems, plannedPurchases] = await Promise.all([
    repositories.transactionLineItems.listByUser(userId),
    repositories.plannedPurchases.listByUser(userId),
  ]);
  const cascade = planLineItemCascade({
    deletedTransactionIds: idsToRemove,
    lineItems,
    plannedPurchases,
    timestamp,
  });

  await Promise.all([
    ...[...idsToRemove].map((id) => repositories.transactions.remove(id)),
    ...cascade.lineItemIdsToDelete.map((id) => repositories.transactionLineItems.remove(id)),
    ...cascade.purchasesToRevert.map((purchase) => repositories.plannedPurchases.upsert(purchase)),
  ]);

  return idsToRemove;
}
