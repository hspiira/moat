"use client";

import { Card, CardContent } from "@/components/ui/card";

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
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Investment Compass</h1>
        <p className="text-sm text-muted-foreground">
          Rule-based guidance for Uganda. No stock picks, no guaranteed returns.
        </p>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="px-5 py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-border/40 shadow-none">
          <CardContent className="px-5 py-8 text-sm text-muted-foreground">
            Loading guidance...
          </CardContent>
        </Card>
      ) : null}

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
