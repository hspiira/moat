export type SpendingCategory = {
  categoryId: string;
  categoryName: string;
  amount: number;
  count: number;
};

export type SpendingShareSegment = {
  key: string;
  label: string;
  amount: number;
  count: number | null;
  share: number;
  isRemainder: boolean;
};

export type SpendingShare = {
  total: number;
  segments: SpendingShareSegment[];
};

export const REMAINDER_LABEL = "Everything else";

export function buildSpendingShare(
  categories: SpendingCategory[],
  totalOutflow: number,
): SpendingShare {
  const listed = categories.reduce((sum, category) => sum + category.amount, 0);
  // The panel is handed the top five, so the rest of the period's spending has
  // to be counted too or every share would be overstated.
  const total = Math.max(totalOutflow, listed);

  if (total <= 0) {
    return { total: 0, segments: [] };
  }

  const segments: SpendingShareSegment[] = categories.map((category) => ({
    key: category.categoryId,
    label: category.categoryName,
    amount: category.amount,
    count: category.count,
    share: category.amount / total,
    isRemainder: false,
  }));

  const remainder = total - listed;
  if (remainder > 0) {
    segments.push({
      key: "remainder",
      label: REMAINDER_LABEL,
      amount: remainder,
      count: null,
      share: remainder / total,
      isRemainder: true,
    });
  }

  return { total, segments };
}
