import type { Category, CategoryKind, TransactionType } from "@/lib/types";

/**
 * The minimum a category needs for classification. The capture pipeline passes
 * projections rather than whole records, so the rule reads this shape and not
 * `Category`, and there is no second copy of the kind union to drift.
 */
export type CategoryLike = {
  id: string;
  kind: CategoryKind;
};

/**
 * The single source of truth for which categories a transaction type may use.
 *
 * Two axes describe a transaction: the *type* says what happened to the balance
 * sheet, the *category* says what it was for. They used to overlap — every type
 * that was not income, transfer, or savings fell through to "any expense
 * category" — which is how a debt payment could be filed under Food or Airtime.
 *
 * Each kind here belongs to exactly one type, and a test enforces that. The
 * picker, manual entry, capture, and CSV import all read this map, so there is
 * no second copy to drift.
 */
export const allowedCategoryKinds: Record<TransactionType, CategoryKind[]> = {
  income: ["income"],
  expense: ["expense"],
  // Lending is a transfer: the money moves to a receivable, it is not spent.
  transfer: ["transfer", "lending"],
  savings_contribution: ["savings"],
  debt_payment: ["debt_repayment"],
};

/**
 * The inverse of `allowedCategoryKinds`, built rather than written, so there is
 * no second table to fall out of step. Well-defined precisely because no kind
 * is reachable from two types — the property the tests pin down.
 */
const typeByCategoryKind = Object.entries(allowedCategoryKinds).reduce(
  (map, [type, kinds]) => {
    for (const kind of kinds) {
      map[kind] = type as TransactionType;
    }
    return map;
  },
  {} as Record<CategoryKind, TransactionType>,
);

/**
 * What kind of movement a category implies. This is what lets the type stop
 * being something the user picks: choose "Debt repayment" and the type follows,
 * so the two answers can never contradict each other.
 */
export function transactionTypeForCategory(category: CategoryLike): TransactionType {
  return typeByCategoryKind[category.kind];
}

/**
 * How each kind reads to someone who has never heard the word "kind". Used as
 * the group headings in the category picker.
 */
export const categoryKindLabels: Record<CategoryKind, string> = {
  income: "Income",
  expense: "Spending",
  savings: "Savings",
  transfer: "Transfers",
  debt_repayment: "Debt",
  lending: "Lending",
};

/** Money in, money out, then the moves that are neither. */
export const categoryKindOrder: CategoryKind[] = [
  "income",
  "expense",
  "savings",
  "transfer",
  "debt_repayment",
  "lending",
];

export function categoryMatchesType(category: CategoryLike, type: TransactionType): boolean {
  return allowedCategoryKinds[type].includes(category.kind);
}

export function defaultCategoryForType<T extends CategoryLike>(
  categories: T[],
  type: TransactionType,
): T | undefined {
  return categories.find((category) => categoryMatchesType(category, type));
}

function typeLabel(type: TransactionType): string {
  return type.replaceAll("_", " ");
}

/**
 * Manual entry: refuse an incoherent pair. The user is present and can fix it,
 * and silently rewriting what they chose would be worse than saying no.
 */
export function assertCategoryMatchesType(
  categories: Category[],
  type: TransactionType,
  categoryId: string,
): void {
  const category = categories.find((entry) => entry.id === categoryId);

  if (!category) {
    throw new Error(`${categoryId} is not a category you can use.`);
  }

  if (!categoryMatchesType(category, type)) {
    throw new Error(
      `"${category.name}" cannot be used for a ${typeLabel(type)}. ` +
        `Pick a ${typeLabel(type)} category instead.`,
    );
  }
}

/**
 * Imported and parsed rows: snap to something coherent instead of throwing.
 * There is no user standing by to correct an SMS or a CSV column, and losing
 * the row is worse than filing it under the type's default category. Returns
 * the original id when the catalogue offers nothing better, so the caller still
 * sees a value rather than an empty category.
 */
export function coerceCategoryForType(
  categories: CategoryLike[],
  type: TransactionType,
  categoryId: string,
): string {
  const category = categories.find((entry) => entry.id === categoryId);

  if (category && categoryMatchesType(category, type)) {
    return categoryId;
  }

  return defaultCategoryForType(categories, type)?.id ?? categoryId;
}
