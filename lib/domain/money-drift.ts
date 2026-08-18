import type { Account, BudgetTarget, Goal, Transaction } from "@/lib/types";

export type MoneyDriftPlan = {
  transactions: Transaction[];
  accounts: Account[];
  goals: Goal[];
  budgets: BudgetTarget[];
  /** Every field corrected, for reporting what changed. */
  corrections: Array<{ store: string; id: string; field: string; from: number; to: number }>;
};

function isDrifted(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && !Number.isInteger(value);
}

export function findMoneyDrift(input: {
  transactions: Transaction[];
  accounts: Account[];
  goals: Goal[];
  budgets: BudgetTarget[];
  timestamp: string;
}): MoneyDriftPlan {
  const corrections: MoneyDriftPlan["corrections"] = [];

  const fix = <T extends { id: string }>(
    store: string,
    record: T,
    fields: Array<keyof T & string>,
  ): T | null => {
    const patch: Record<string, number> = {};

    for (const field of fields) {
      const value = record[field];
      if (!isDrifted(value)) continue;
      const rounded = Math.round(value);
      patch[field] = rounded;
      corrections.push({ store, id: record.id, field, from: value, to: rounded });
    }

    return Object.keys(patch).length > 0 ? { ...record, ...patch } : null;
  };

  const transactions = input.transactions
    .map((row) => {
      const isForeign = row.currency !== "UGX";
      const repaired = fix("transactions", row, isForeign ? ["amount"] : ["amount", "originalAmount"]);
      if (!repaired) return null;
      return { ...repaired, updatedAt: input.timestamp };
    })
    .filter((row): row is Transaction => row !== null);

  const accounts = input.accounts
    .map((account) => {
      const repaired = fix("accounts", account, [
        "openingBalance",
        "balance",
        "debtPrincipal",
      ]);
      if (!repaired) return null;
      return { ...repaired, updatedAt: input.timestamp };
    })
    .filter((account): account is Account => account !== null);

  const goals = input.goals
    .map((goal) => {
      const repaired = fix("goals", goal, ["targetAmount", "currentAmount"]);
      if (!repaired) return null;
      return { ...repaired, updatedAt: input.timestamp };
    })
    .filter((goal): goal is Goal => goal !== null);

  const budgets = input.budgets
    .map((budget) => {
      const repaired = fix("budgets", budget, ["targetAmount", "rolloverAmount"]);
      if (!repaired) return null;
      return { ...repaired, updatedAt: input.timestamp };
    })
    .filter((budget): budget is BudgetTarget => budget !== null);

  return { transactions, accounts, goals, budgets, corrections };
}

export function hasMoneyDrift(plan: MoneyDriftPlan): boolean {
  return plan.corrections.length > 0;
}
