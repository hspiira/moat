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

describe("the profile answers beyond the time horizon", () => {
  const settled = { emergencyFundMonthsCovered: 6, hasHighCostDebt: false };

  it("leaves out anything that can fall in value when risk comfort is low", () => {
    const cautious = getInvestmentGuidance({
      profile: buildProfile({ riskComfort: "low" }),
      ...settled,
    });
    const comfortable = getInvestmentGuidance({
      profile: buildProfile({ riskComfort: "high" }),
      ...settled,
    });

    expect(comfortable.recommendedProducts).toContain(
      "Licensed unit trusts / collective investment schemes",
    );
    expect(cautious.recommendedProducts).not.toContain(
      "Licensed unit trusts / collective investment schemes",
    );
  });

  it("leaves out years-long locks when the money is needed near term", () => {
    const guidance = getInvestmentGuidance({
      profile: buildProfile({ liquidityNeed: "near_term" }),
      ...settled,
    });

    expect(guidance.recommendedProducts).not.toContain("Treasury bonds");
    expect(guidance.recommendedProducts).not.toContain("Retirement savings products");
  });

  it("keeps an emergency fund reachable however far off the horizon is", () => {
    const guidance = getInvestmentGuidance({
      profile: buildProfile({ timeHorizonMonths: 120, goalFocus: "emergency_fund" }),
      ...settled,
    });

    expect(guidance.recommendedProducts).toEqual([
      "Cash savings",
      "Bank savings",
      "Licensed SACCO savings",
    ]);
  });

  it("never returns an empty list when every answer rules something out", () => {
    const guidance = getInvestmentGuidance({
      profile: buildProfile({
        timeHorizonMonths: 24,
        liquidityNeed: "immediate",
        riskComfort: "low",
      }),
      ...settled,
    });

    expect(guidance.recommendedProducts.length).toBeGreaterThan(0);
  });

  it("says why a class was left out only when detailed guidance is asked for", () => {
    const detailed = getInvestmentGuidance({
      profile: buildProfile({ riskComfort: "low", guidanceLevel: "detailed" }),
      ...settled,
    });
    const starter = getInvestmentGuidance({
      profile: buildProfile({ riskComfort: "low", guidanceLevel: "starter" }),
      ...settled,
    });

    expect(detailed.removals.join(" ")).toContain("its value can fall as well as rise");
    expect(starter.removals).toEqual([]);
  });

  it("keeps a starter answer to one line and a standard answer to all of them", () => {
    const starter = getInvestmentGuidance({
      profile: buildProfile({ guidanceLevel: "starter" }),
      emergencyFundMonthsCovered: 1,
      hasHighCostDebt: true,
    });
    const standard = getInvestmentGuidance({
      profile: buildProfile({ guidanceLevel: "standard" }),
      emergencyFundMonthsCovered: 1,
      hasHighCostDebt: true,
    });

    expect(starter.rationale).toHaveLength(1);
    expect(standard.rationale.length).toBeGreaterThan(1);
  });
});
