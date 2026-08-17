import { ensureFeesCategory } from "@/lib/app-state/defaults";
import { planLineItemCascade } from "@/lib/domain/line-item-cascade";
import { planTransactionCascade } from "@/lib/domain/transaction-cascade";
import type { TransactionWritePlan } from "@/lib/domain/transaction-write-plan";
import { repositories } from "@/lib/repositories/instance";
import type { Category, Transaction } from "@/lib/types";

/** Writes first, prunes last: an interruption leaves a duplicate, not a hole. */
export async function applyTransactionWrite(
  plan: TransactionWritePlan,
  categories: Category[],
  userId: string,
): Promise<void> {
  await Promise.all(plan.rows.map((row) => repositories.transactions.upsert(row)));

  if (plan.fee) {
    const feesCategory = ensureFeesCategory(categories, userId);
    if (feesCategory) {
      await repositories.categories.upsert(feesCategory);
    }
    await repositories.transactions.upsert(plan.fee);
  }

  await Promise.all(plan.staleIds.map((id) => repositories.transactions.remove(id)));
}

/** Removes a transaction and everything that only existed because of it. */
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
