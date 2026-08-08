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

export type LineItemField = "quantity" | "unitPrice" | "amount";

export type LineItemDraftValues = {
  quantity?: number;
  unitPrice?: number;
  amount?: number;
};

export type ResolvedLineItemDraft = LineItemDraftValues & {
  /** Which field this resolution filled in, or null if nothing could be. */
  derived: LineItemField | null;
};

/**
 * Fills in whichever of quantity, unit price, and amount you did not type.
 *
 * Any two of the three determine the third, and which two you have depends on
 * the receipt: a price tag gives a unit price, a handwritten total does not.
 * So rather than fixing one field as the computed one, the two you touched
 * most recently win and the third is solved for.
 *
 * `recentlyEdited` is most-recent-first and lists only fields the user
 * actually typed into, so a stale value left in form state never outranks
 * something just entered.
 */
export function resolveLineItemDraft(
  values: LineItemDraftValues,
  recentlyEdited: LineItemField[],
): ResolvedLineItemDraft {
  const blank: ResolvedLineItemDraft = {
    quantity: undefined,
    unitPrice: undefined,
    amount: undefined,
    derived: null,
  };

  const known = recentlyEdited.filter((field) => values[field] != null);
  const [first, second] = known;

  if (!first || !second) {
    // Nothing to solve from; echo back only what the user actually entered.
    return { ...blank, ...pick(values, known) };
  }

  const pair = new Set<LineItemField>([first, second]);
  const target = (["quantity", "unitPrice", "amount"] as const).find(
    (field) => !pair.has(field),
  )!;

  const quantity = values.quantity;
  const unitPrice = values.unitPrice;
  const amount = values.amount;

  // Division by zero would invent a value out of nothing, so those cases stay
  // unresolved rather than guessing.
  if (target === "amount") {
    return { quantity, unitPrice, amount: quantity! * unitPrice!, derived: "amount" };
  }
  if (target === "unitPrice") {
    if (quantity === 0) return { ...blank, quantity, amount, derived: null };
    return { quantity, unitPrice: amount! / quantity!, amount, derived: "unitPrice" };
  }
  if (unitPrice === 0) return { ...blank, unitPrice, amount, derived: null };
  return { quantity: amount! / unitPrice!, unitPrice, amount, derived: "quantity" };
}

function pick(values: LineItemDraftValues, fields: LineItemField[]): LineItemDraftValues {
  return Object.fromEntries(fields.map((field) => [field, values[field]]));
}
