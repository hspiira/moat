"use client";

import { BudgetManagerPanel } from "@/components/budgets/budget-manager-panel";
import { FeaturePageShell } from "@/components/feature-page-shell";

import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";

export function BudgetsWorkspace() {
  const workspace = useTransactionsWorkspace();

  return (
    <FeaturePageShell
      title="Budgets"
      description="Set a monthly limit per category and track what is left."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
      loadingMessage="Loading budgets..."
      setupMessage="Complete onboarding and add at least one account before setting budgets."
    >
      <BudgetManagerPanel
        month={workspace.closePeriod}
        categories={workspace.categories}
        budgets={workspace.budgets}
        transactions={workspace.transactions}
        form={workspace.budgetForm}
        isSubmitting={workspace.isSubmitting}
        onFormChange={workspace.setBudgetForm}
        onSave={() => void workspace.saveBudget()}
        onEdit={workspace.editBudget}
        onDelete={(budgetId) => void workspace.deleteBudget(budgetId)}
        onCancelEdit={workspace.cancelBudgetEdit}
      />
    </FeaturePageShell>
  );
}
