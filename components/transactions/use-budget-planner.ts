"use client";

// Budget slice of the transactions workspace: form state and CRUD for
// monthly budget targets. Composed inside useTransactionsWorkspace.

import { useCallback, useState } from "react";

import { repositories } from "@/lib/repositories/instance";
import type { BudgetTarget, Category, UserProfile } from "@/lib/types";

export type BudgetFormState = {
  budgetId: string | null;
  categoryId: string;
  targetAmount: string;
  rolloverAmount: string;
  incomeTransactionId: string;
};

function emptyBudgetForm(categories: Category[]): BudgetFormState {
  return {
    budgetId: null,
    categoryId: categories.find((category) => category.kind === "expense")?.id ?? "",
    targetAmount: "",
    rolloverAmount: "",
    incomeTransactionId: "",
  };
}

export function useBudgetPlanner(params: {
  profile: UserProfile | null;
  categories: Category[];
  closePeriod: string;
  onMutated: () => Promise<void>;
  setIsSubmitting: (value: boolean) => void;
}) {
  const { profile, categories, closePeriod, onMutated, setIsSubmitting } = params;
  const [budgets, setBudgets] = useState<BudgetTarget[]>([]);
  const [budgetForm, setBudgetForm] = useState<BudgetFormState>({
    budgetId: null,
    categoryId: "",
    targetAmount: "",
    rolloverAmount: "",
    incomeTransactionId: "",
  });

  const saveBudget = useCallback(async () => {
    if (!profile || !budgetForm.categoryId) return;
    setIsSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      const existing =
        budgets.find((budget) => budget.id === budgetForm.budgetId) ??
        budgets.find((budget) => budget.categoryId === budgetForm.categoryId);
      await repositories.budgets.upsert({
        id: existing?.id ?? `budget:${closePeriod}:${budgetForm.categoryId}`,
        userId: profile.id,
        month: closePeriod,
        categoryId: budgetForm.categoryId,
        targetAmount: Number(budgetForm.targetAmount) || 0,
        rolloverAmount: Number(budgetForm.rolloverAmount) || 0,
        incomeTransactionId: budgetForm.incomeTransactionId || undefined,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });
      setBudgetForm(emptyBudgetForm(categories));
      await onMutated();
    } finally {
      setIsSubmitting(false);
    }
  }, [budgetForm, budgets, categories, closePeriod, onMutated, profile, setIsSubmitting]);

  const editBudget = useCallback(
    (budgetId: string) => {
      const budget = budgets.find((entry) => entry.id === budgetId);
      if (!budget) return;

      setBudgetForm({
        budgetId: budget.id,
        categoryId: budget.categoryId,
        targetAmount: String(budget.targetAmount),
        rolloverAmount: String(budget.rolloverAmount ?? 0),
        incomeTransactionId: budget.incomeTransactionId ?? "",
      });
    },
    [budgets],
  );

  const deleteBudget = useCallback(
    async (budgetId: string) => {
      setIsSubmitting(true);
      try {
        await repositories.budgets.remove(budgetId);
        setBudgetForm((current) =>
          current.budgetId === budgetId ? emptyBudgetForm(categories) : current,
        );
        await onMutated();
      } finally {
        setIsSubmitting(false);
      }
    },
    [categories, onMutated, setIsSubmitting],
  );

  const cancelBudgetEdit = useCallback(() => {
    setBudgetForm(emptyBudgetForm(categories));
  }, [categories]);

  return {
    budgets,
    setBudgets,
    budgetForm,
    setBudgetForm,
    saveBudget,
    editBudget,
    deleteBudget,
    cancelBudgetEdit,
  };
}
