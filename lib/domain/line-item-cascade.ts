import { revertPurchase } from "@/lib/domain/planned-purchases";
import type { PlannedPurchase, TransactionLineItem } from "@/lib/types";

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
