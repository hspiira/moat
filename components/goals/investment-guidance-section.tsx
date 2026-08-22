"use client";

import { AppSectionHeading } from "@/components/app-page";
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

  return (
    <section className="grid gap-4">
      <AppSectionHeading
        title="Money you are not spending"
        description="What to do with a surplus. No stock picks, no guaranteed returns."
      />

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
    </section>
  );
}
