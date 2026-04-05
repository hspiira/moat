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
    rationale.push("The user does not yet have at least three months of emergency coverage.");
  }

  if (shouldPrioritizeDebtRepayment) {
    warnings.push("Reduce high-cost debt before taking on higher-risk investing decisions.");
    rationale.push("Debt cost is likely to outweigh expected near-term investment gains.");
  }

  if (profile.timeHorizonMonths < 12) {
    recommendedProducts.push("Cash savings", "Bank savings", "Licensed SACCO savings");
    rationale.push("The goal horizon is under 12 months, so liquidity and capital stability come first.");
  } else if (profile.timeHorizonMonths <= 36) {
    recommendedProducts.push("Bank savings", "Treasury bills", "Short-duration conservative funds");
    rationale.push("The goal horizon is medium term, so capital preservation matters more than aggressive growth.");
  } else {
    recommendedProducts.push(
      "Treasury bonds",
      "Licensed unit trusts / collective investment schemes",
      "Retirement savings products",
    );
    rationale.push("The goal horizon is long enough to consider diversified regulated long-term products.");
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
