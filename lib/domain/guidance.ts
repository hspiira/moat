import type { InvestmentGuidance, InvestmentProfile } from "@/lib/types";

type GuidanceInput = {
  profile: InvestmentProfile;
  emergencyFundMonthsCovered: number;
  hasHighCostDebt: boolean;
};

export function getInvestmentGuidance({
  profile,
  emergencyFundMonthsCovered,
  hasHighCostDebt,
}: GuidanceInput): InvestmentGuidance {
  const recommendedProducts: string[] = [];
  const warnings: string[] = [];
  const rationale: string[] = [];

  const shouldPrioritizeEmergencyFund = emergencyFundMonthsCovered < 3;
  const shouldPrioritizeDebtRepayment = hasHighCostDebt;

  if (shouldPrioritizeEmergencyFund) {
    warnings.push("Build a stronger emergency fund before committing more money to long-term risk.");
    rationale.push("You don't yet have at least three months of emergency cover.");
  }

  if (shouldPrioritizeDebtRepayment) {
    warnings.push("Reduce high-cost debt before taking on higher-risk investing decisions.");
    rationale.push("Debt cost is likely to outweigh expected near-term investment gains.");
  }

  if (profile.timeHorizonMonths < 12) {
    recommendedProducts.push("Cash savings", "Bank savings", "Licensed SACCO savings");
    rationale.push("Your goal is under 12 months away, so keeping the money safe and reachable comes first.");
  } else if (profile.timeHorizonMonths <= 36) {
    recommendedProducts.push("Bank savings", "Treasury bills", "Short-duration conservative funds");
    rationale.push("Your goal is a few years out, so protecting the money matters more than chasing high growth.");
  } else {
    recommendedProducts.push(
      "Treasury bonds",
      "Licensed unit trusts / collective investment schemes",
      "Retirement savings products",
    );
    rationale.push("Your goal is far enough out to consider regulated long-term investments.");
  }

  if (profile.liquidityNeed === "immediate") {
    warnings.push("Do not lock up money that may be needed soon for rent, school fees, or emergencies.");
  }

  return {
    recommendedProducts,
    warnings,
    rationale,
    shouldPrioritizeEmergencyFund,
    shouldPrioritizeDebtRepayment,
  };
}
