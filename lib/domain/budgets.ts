import type { BudgetTarget, Category, Transaction } from "@/lib/types";

export type BudgetEnvelope = {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  allocated: number;
  rollover: number;
  spent: number;
  remaining: number;
  isOverspent: boolean;
  incomeTransactionId?: string;
};

export type IncomeFundingSummary = {
  transactionId: string;
  date: string;
  payee?: string;
  amount: number;
  allocated: number;
  remaining: number;
  linkedBudgetCount: number;
};

export function getBudgetEnvelopes(
  budgets: BudgetTarget[],
  categories: Category[],
  transactions: Transaction[],
): BudgetEnvelope[] {
  const categoryLookup = new Map(categories.map((category) => [category.id, category.name]));
  const spendingByCategory = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.type !== "expense" && transaction.type !== "debt_payment") {
      continue;
    }

    spendingByCategory.set(
      transaction.categoryId,
      (spendingByCategory.get(transaction.categoryId) ?? 0) + Math.abs(transaction.amount),
    );
  }

  return budgets
    .map((budget) => {
      const rollover = budget.rolloverAmount ?? 0;
      const allocated = budget.targetAmount + rollover;
      const spent = spendingByCategory.get(budget.categoryId) ?? 0;
      const remaining = allocated - spent;

      return {
        budgetId: budget.id,
        categoryId: budget.categoryId,
        categoryName: categoryLookup.get(budget.categoryId) ?? "Uncategorized",
        allocated,
        rollover,
        spent,
        remaining,
        isOverspent: remaining < 0,
        incomeTransactionId: budget.incomeTransactionId,
      };
    })
    .sort((left, right) => left.categoryName.localeCompare(right.categoryName));
}

export function getBudgetCoverage(
  budgets: BudgetTarget[],
  transactions: Transaction[],
) {
  const allocated = budgets.reduce(
    (sum, budget) => sum + budget.targetAmount + (budget.rolloverAmount ?? 0),
    0,
  );
  const spent = transactions.reduce((sum, transaction) => {
    if (transaction.type !== "expense" && transaction.type !== "debt_payment") {
      return sum;
    }

    return sum + Math.abs(transaction.amount);
  }, 0);

  return {
    allocated,
    spent,
    remaining: allocated - spent,
  };
}

export function getBudgetFundingCapacity(
  budgets: BudgetTarget[],
  transactions: Transaction[],
) {
  const inflow = transactions.reduce((sum, transaction) => {
    if (transaction.type !== "income") {
      return sum;
    }

    return sum + Math.abs(transaction.amount);
  }, 0);

  const allocated = budgets.reduce(
    (sum, budget) => sum + budget.targetAmount + (budget.rolloverAmount ?? 0),
    0,
  );

  return {
    inflow,
    allocated,
    unallocatedIncome: inflow - allocated,
  };
}

export function getIncomeFundingSummaries(
  budgets: BudgetTarget[],
  transactions: Transaction[],
) {
  const incomeTransactions = transactions.filter((transaction) => transaction.type === "income");

  return incomeTransactions
    .map<IncomeFundingSummary>((transaction) => {
      const linkedBudgets = budgets.filter(
        (budget) => budget.incomeTransactionId === transaction.id,
      );
      const allocated = linkedBudgets.reduce(
        (sum, budget) => sum + budget.targetAmount + (budget.rolloverAmount ?? 0),
        0,
      );

      return {
        transactionId: transaction.id,
        date: transaction.occurredOn,
        payee: transaction.payee ?? transaction.rawPayee,
        amount: Math.abs(transaction.amount),
        allocated,
        remaining: Math.abs(transaction.amount) - allocated,
        linkedBudgetCount: linkedBudgets.length,
      };
    })
    .sort((left, right) => right.date.localeCompare(left.date));
}
