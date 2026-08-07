import type { TransactionLineItem } from "@/lib/types";

export function lineItemAmount(
  line: Pick<TransactionLineItem, "amount" | "quantity" | "unitPrice">,
): number | undefined {
  if (line.amount != null) {
    return line.amount;
  }
  if (line.quantity != null && line.unitPrice != null) {
    return line.quantity * line.unitPrice;
  }
  return undefined;
}

export type ItemizationSummary = {
  itemizedTotal: number;
  unitemized: number;
  overItemizedBy: number;
};

/**
 * Itemization is informal: lines may cover part, all, or (by mistake) more
 * than the transaction amount. Over-coverage is reported, never clamped, so
 * the UI can say "over-itemized by X" instead of silently lying.
 */
export function summarizeItemization(
  transactionAmount: number,
  lineItems: TransactionLineItem[],
): ItemizationSummary {
  const itemizedTotal = lineItems.reduce(
    (total, line) => total + (lineItemAmount(line) ?? 0),
    0,
  );
  return {
    itemizedTotal,
    unitemized: Math.max(0, transactionAmount - itemizedTotal),
    overItemizedBy: Math.max(0, itemizedTotal - transactionAmount),
  };
}
