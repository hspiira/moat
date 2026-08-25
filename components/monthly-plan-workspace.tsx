"use client";

import { BudgetManagerPanel } from "@/components/budgets/budget-manager-panel";
import { FeaturePageShell } from "@/components/feature-page-shell";
import { todayIso } from "@/lib/today";

import { RecurringObligationsPanel } from "./transactions/recurring-obligations-panel";
import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";

/**
 * What this month is already committed to and what it is capped at. Bills come
 * first because they are not a choice; budgets are what is left to decide.
 */
export function MonthlyPlanWorkspace() {
  const workspace = useTransactionsWorkspace();

  return (
    <FeaturePageShell
      title="Monthly plan"
      srOnlyTitle
      description="What this month already owes, and what you are capping."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
      loadingMessage="Loading this month's plan..."
      setupMessage="Complete onboarding and add at least one account before planning a month."
    >
      <div className="grid gap-8">
        <section className="grid gap-2">
          <h2 className="text-base font-semibold text-foreground">Bills that repeat</h2>
          <p className="text-sm text-muted-foreground">
            Rent, school fees, and other obligations that come round every month.
          </p>
          <RecurringObligationsPanel
            accounts={workspace.accounts}
            categories={workspace.categories}
            evaluations={workspace.recurringEvaluations}
            obligations={workspace.recurringObligations}
            today={todayIso()}
            isSubmitting={workspace.isSubmitting}
            onSaveObligation={(obligation) => void workspace.saveObligation(obligation)}
            onToggleObligation={(obligation) => void workspace.toggleObligation(obligation)}
          />
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-semibold text-foreground">Budgets</h2>
          <p className="text-sm text-muted-foreground">
            A monthly limit per category, and what is left of each.
          </p>
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
        </section>
      </div>
    </FeaturePageShell>
  );
}
