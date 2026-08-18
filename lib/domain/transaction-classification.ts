import type { Category, CategoryKind, TransactionType } from "@/lib/types";

export type CategoryLike = {
  id: string;
  kind: CategoryKind;
};

export const allowedCategoryKinds: Record<TransactionType, CategoryKind[]> = {
  income: ["income"],
  expense: ["expense"],
  transfer: ["transfer", "lending"],
  savings_contribution: ["savings"],
  debt_payment: ["debt_repayment"],
};

const typeByCategoryKind = Object.entries(allowedCategoryKinds).reduce(
  (map, [type, kinds]) => {
    for (const kind of kinds) {
      map[kind] = type as TransactionType;
    }
    return map;
  },
  {} as Record<CategoryKind, TransactionType>,
);

export function transactionTypeForCategory(category: CategoryLike): TransactionType {
  return typeByCategoryKind[category.kind];
}

export const categoryKindLabels: Record<CategoryKind, string> = {
  income: "Income",
  expense: "Spending",
  savings: "Savings",
  transfer: "Transfers",
  debt_repayment: "Debt",
  lending: "Lending",
};

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
