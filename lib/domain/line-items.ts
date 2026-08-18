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
  derived: LineItemField | null;
};

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
    return { ...blank, ...pick(values, known) };
  }

  const pair = new Set<LineItemField>([first, second]);
  const target = (["quantity", "unitPrice", "amount"] as const).find(
    (field) => !pair.has(field),
  )!;

  const quantity = values.quantity;
  const unitPrice = values.unitPrice;
  const amount = values.amount;

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
