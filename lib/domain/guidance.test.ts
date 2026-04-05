import { describe, expect, it } from "vitest";

import { getInvestmentGuidance } from "@/lib/domain/guidance";
import type { InvestmentProfile } from "@/lib/types";

function buildProfile(
  overrides: Partial<InvestmentProfile> = {},
): InvestmentProfile {
  return {
    id: "investment-profile:user:default",
    userId: "user:default",
    timeHorizonMonths: 48,
    liquidityNeed: "long_term",
    riskComfort: "moderate",
    goalFocus: "general_wealth",
    guidanceLevel: "starter",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getInvestmentGuidance", () => {
  it("pushes short-term goals toward liquid and conservative products", () => {
    const guidance = getInvestmentGuidance({
      profile: buildProfile({
        timeHorizonMonths: 6,
        liquidityNeed: "immediate",
      }),
      emergencyFundMonthsCovered: 1,
      hasHighCostDebt: false,
    });

    expect(guidance.recommendedProducts).toEqual([
      "Cash savings",
      "Bank savings",
      "Licensed SACCO savings",
    ]);
    expect(guidance.shouldPrioritizeEmergencyFund).toBe(true);
    expect(guidance.warnings).toContain(
      "Do not lock up money that may be needed soon for rent, school fees, or emergencies.",
    );
  });

  it("pushes debt repayment ahead of longer-term risk taking", () => {
    const guidance = getInvestmentGuidance({
      profile: buildProfile(),
      emergencyFundMonthsCovered: 4,
      hasHighCostDebt: true,
    });

    expect(guidance.shouldPrioritizeDebtRepayment).toBe(true);
    expect(guidance.recommendedProducts).toContain("Treasury bonds");
    expect(guidance.warnings).toContain(
      "Reduce high-cost debt before taking on higher-risk investing decisions.",
    );
  });
});
