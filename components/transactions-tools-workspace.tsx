"use client";

import { BudgetManagerPanel } from "@/components/budgets/budget-manager-panel";

import { TransactionRulesPanel } from "./transactions/transaction-rules-panel";
import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";
import { TransactionsWorkspaceFrame } from "./transactions/transactions-workspace-frame";

export function TransactionsToolsWorkspace() {
  const workspace = useTransactionsWorkspace();

  return (
    <TransactionsWorkspaceFrame
      currentRoute="tools"
      title="Tools"
      description="Rules and budget administration sit here instead of competing with daily transaction review."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
      transactionCount={workspace.transactions.length}
      periodTransactionCount={workspace.periodTransactions.length}
      reviewCount={workspace.reviewCount + workspace.captureReviewCount}
      duplicateCount={workspace.duplicateCount}
      periodSummary={workspace.periodSummary}
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <TransactionRulesPanel
          accounts={workspace.accounts}
          categories={workspace.categories}
          rules={workspace.transactionRules}
          isSubmitting={workspace.isSubmitting}
          onSaveRule={(rule) => void workspace.saveRule(rule)}
          onToggleRule={(rule) => void workspace.toggleRule(rule)}
        />

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
      </div>
    </TransactionsWorkspaceFrame>
  );
}
