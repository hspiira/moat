"use client";
import { PageHeader } from "@/components/page-shell/page-header";
import {
  ErrorStateCard,
  LoadingStateCard,
} from "@/components/page-shell/page-state";

import {
  InvestmentEmptyState,
  InvestmentGuidancePanels,
  InvestmentMetricCards,
  InvestmentProfileCard,
} from "./investment-compass/investment-compass-sections";
import { useInvestmentCompassWorkspace } from "./investment-compass/use-investment-compass-workspace";

export function InvestmentCompassWorkspace() {
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
    error,
    lastSavedAt,
    successMessage,
    setForm,
    handleSubmit,
  } = useInvestmentCompassWorkspace();

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Investment Compass"
        description="Rule-based guidance for Uganda. No stock picks, no guaranteed returns."
      />

      {error ? <ErrorStateCard message={error} /> : null}
      {isLoading ? <LoadingStateCard message="Loading guidance..." /> : null}

      {!isLoading && !profile ? <InvestmentEmptyState /> : null}

      {!isLoading && profile && investmentProfile && guidance ? (
        <>
          <InvestmentMetricCards
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
              warnings={guidance.warnings}
              regulatedResources={regulatedResources}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
