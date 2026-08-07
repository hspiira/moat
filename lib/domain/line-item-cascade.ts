import { revertPurchase } from "@/lib/domain/planned-purchases";
import type { PlannedPurchase, TransactionLineItem } from "@/lib/types";

/**
 * Everything a transaction delete must take with it: its line items, and the
 * reversal of any planned purchases those line items had fulfilled. Pure so
 * the workspace hook only executes the plan.
 */
export function planLineItemCascade(params: {
  deletedTransactionIds: ReadonlySet<string>;
  lineItems: TransactionLineItem[];
  plannedPurchases: PlannedPurchase[];
  timestamp: string;
}): { lineItemIdsToDelete: string[]; purchasesToRevert: PlannedPurchase[] } {
  const doomedLines = params.lineItems.filter((line) =>
    params.deletedTransactionIds.has(line.transactionId),
  );
  const doomedLineIds = new Set(doomedLines.map((line) => line.id));
  const purchasesToRevert = params.plannedPurchases
    .filter(
      (purchase) =>
        purchase.linkedLineItemId != null && doomedLineIds.has(purchase.linkedLineItemId),
    )
    .map((purchase) => revertPurchase(purchase, params.timestamp));
  return {
    lineItemIdsToDelete: [...doomedLineIds],
    purchasesToRevert,
  };
}
