"use client";

import { IconChevronRight } from "@tabler/icons-react";


import {
  InvestmentGuidancePanels,
  InvestmentBasis,
  InvestmentProfileCard,
} from "@/components/investment-compass/investment-compass-sections";
import { useInvestmentCompassWorkspace } from "@/components/investment-compass/use-investment-compass-workspace";

// The guidance is keyed to a time horizon, which is exactly what a goal carries.
// On a page of its own it read as an empty room; next to the goals that drive it,
// the same rules read as advice.
export function InvestmentGuidanceSection() {
  const {
    profile,
    investmentProfile,
    form,
    monthlyOutflow,
    emergencyFundMonthsCovered,
    guidance,
    regulatedResources,
    isLoading,
    isSubmitting,
    lastSavedAt,
    successMessage,
    setForm,
    handleSubmit,
  } = useInvestmentCompassWorkspace();

  if (isLoading || !profile || !investmentProfile || !guidance) {
    return null;
  }

  // Guidance about a surplus is worth having, but it is not why anyone opens
  // Goals. It stays one tap away rather than running on below every goal.
  return (
    <details className="group/guidance grid gap-4">
      <summary className="flex cursor-pointer list-none items-start gap-1.5 [&::-webkit-details-marker]:hidden">
        <IconChevronRight
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open/guidance:rotate-90"
        />
        <span className="min-w-0 space-y-0.5">
          <h2 className="text-sm font-medium text-foreground">Money you are not spending</h2>
          <span className="block text-xs text-muted-foreground">
            What to do with a surplus. No stock picks, no guaranteed returns.
          </span>
        </span>
      </summary>

      <InvestmentBasis
        monthlyOutflow={monthlyOutflow}
        emergencyFundMonthsCovered={emergencyFundMonthsCovered}
      />

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <InvestmentProfileCard
          form={form}
          isSubmitting={isSubmitting}
          lastSavedAt={lastSavedAt}
          successMessage={successMessage}
          onFormChange={setForm}
          onSubmit={handleSubmit}
        />

        <InvestmentGuidancePanels
          recommendedProducts={guidance.recommendedProducts}
          rationale={guidance.rationale}
          removals={guidance.removals}
          warnings={guidance.warnings}
          regulatedResources={regulatedResources}
        />
      </div>
    </details>
  );
}
