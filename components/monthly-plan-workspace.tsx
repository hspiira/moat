"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { BudgetManagerPanel } from "@/components/budgets/budget-manager-panel";
import { FeaturePageShell } from "@/components/feature-page-shell";
import { usePersistedSelection } from "@/components/hooks/use-persisted-selection";
import { MonthlyPlanHeadline } from "@/components/monthly-plan-headline";
import { FilterChips } from "@/components/ui/filter-chips";
import { todayIso } from "@/lib/today";

import { RecurringObligationsPanel } from "./transactions/recurring-obligations-panel";
import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";

type PlanSection = "bills" | "budgets";

function isPlanSection(value: unknown): value is PlanSection {
  return value === "bills" || value === "budgets";
}

const SECTIONS: ReadonlyArray<{ value: PlanSection; label: string }> = [
  { value: "bills", label: "Bills" },
  { value: "budgets", label: "Budgets" },
];

/**
 * What this month is already committed to and what it is capped at. Bills and
 * budgets are two halves of one plan, and stacking them meant budgets moved
 * further down the page with every bill ever recorded. They are sections now,
 * so reaching either is one tap wherever the month's history has got to.
 */
export function MonthlyPlanWorkspace() {
  const workspace = useTransactionsWorkspace();
  const params = useSearchParams();

  // Arriving from /budgets or /recurring names the half you wanted, so the
  // link wins. Otherwise the page opens where you left it last time.
  const requested = params.get("section");
  const [section, selectSection] = usePersistedSelection<PlanSection>(
    "moat.plan-section",
    "bills",
    isPlanSection,
  );
  const [seenRequest, setSeenRequest] = useState<string | null>(null);
  if (requested !== seenRequest) {
    setSeenRequest(requested);
    if (isPlanSection(requested) && requested !== section) {
      selectSection(requested);
    }
  }

  return (
    <FeaturePageShell
      title="Monthly plan"
      description="What this month already owes, and what you are capping."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
      loadingMessage="Loading this month's plan..."
      setupMessage="Complete onboarding and add at least one account before planning a month."
    >
      <div className="grid min-w-0 gap-4">
        <MonthlyPlanHeadline
          month={workspace.closePeriod}
          budgets={workspace.budgets}
          categories={workspace.categories}
          transactions={workspace.transactions}
          evaluations={workspace.recurringEvaluations}
        />

        <FilterChips
          label="Plan section"
          options={SECTIONS}
          value={section}
          onChange={selectSection}
        />

        {section === "bills" ? (
          <section className="grid min-w-0 gap-2">
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
              showSummary={false}
            />
          </section>
        ) : (
          <section className="grid min-w-0 gap-2">
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
              showSummary={false}
            />
          </section>
        )}
      </div>
    </FeaturePageShell>
  );
}
