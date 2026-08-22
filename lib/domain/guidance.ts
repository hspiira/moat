import type { InvestmentGuidance, InvestmentProfile } from "@/lib/types";

type GuidanceInput = {
  profile: InvestmentProfile;
  emergencyFundMonthsCovered: number;
  hasHighCostDebt: boolean;
};

// Every rule below only ever removes a class or explains one. Nothing here
// claims a return, and nothing widens the list, so a cautious answer stays
// cautious however the profile is filled in.
type ProductClass = {
  name: string;
  reachableWithinDays: boolean;
  lock: "none" | "short" | "long";
  movesWithMarket: boolean;
};

const SAFE_AND_REACHABLE: ProductClass[] = [
  { name: "Cash savings", reachableWithinDays: true, lock: "none", movesWithMarket: false },
  { name: "Bank savings", reachableWithinDays: true, lock: "none", movesWithMarket: false },
  {
    name: "Licensed SACCO savings",
    reachableWithinDays: true,
    lock: "none",
    movesWithMarket: false,
  },
];

const NEAR_TERM: ProductClass[] = [
  { name: "Bank savings", reachableWithinDays: true, lock: "none", movesWithMarket: false },
  { name: "Treasury bills", reachableWithinDays: false, lock: "short", movesWithMarket: false },
  {
    name: "Short-duration conservative funds",
    reachableWithinDays: true,
    lock: "short",
    movesWithMarket: true,
  },
];

const LONG_TERM: ProductClass[] = [
  { name: "Treasury bonds", reachableWithinDays: false, lock: "long", movesWithMarket: false },
  {
    name: "Licensed unit trusts / collective investment schemes",
    reachableWithinDays: true,
    lock: "none",
    movesWithMarket: true,
  },
  {
    name: "Retirement savings products",
    reachableWithinDays: false,
    lock: "long",
    movesWithMarket: false,
  },
];

function candidatesFor(timeHorizonMonths: number) {
  if (timeHorizonMonths < 12) return SAFE_AND_REACHABLE;
  if (timeHorizonMonths <= 36) return NEAR_TERM;
  return LONG_TERM;
}

function horizonRationale(timeHorizonMonths: number) {
  if (timeHorizonMonths < 12) {
    return "Your goal is under 12 months away, so keeping the money safe and reachable comes first.";
  }
  if (timeHorizonMonths <= 36) {
    return "Your goal is a few years out, so protecting the money matters more than chasing high growth.";
  }
  return "Your goal is far enough out to consider regulated long-term investments.";
}

export function getInvestmentGuidance({
  profile,
  emergencyFundMonthsCovered,
  hasHighCostDebt,
}: GuidanceInput): InvestmentGuidance {
  const warnings: string[] = [];
  const rationale: string[] = [];
  const removals: string[] = [];

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

  rationale.push(horizonRationale(profile.timeHorizonMonths));

  const mustStayReachable =
    profile.liquidityNeed === "immediate" || profile.goalFocus === "emergency_fund";

  let kept = candidatesFor(profile.timeHorizonMonths);

  function drop(shouldDrop: (entry: ProductClass) => boolean, reason: string) {
    const removed = kept.filter(shouldDrop);
    if (removed.length === 0) return;
    kept = kept.filter((entry) => !shouldDrop(entry));
    removals.push(`${removed.map((entry) => entry.name).join(", ")} left out: ${reason}`);
  }

  if (mustStayReachable) {
    drop(
      (entry) => !entry.reachableWithinDays || entry.lock !== "none",
      "you said this money has to stay within reach",
    );
    drop(
      (entry) => entry.movesWithMarket,
      "its value could be down on the day you need the money",
    );
    warnings.push(
      "Do not lock up money that may be needed soon for rent, school fees, or emergencies.",
    );
    rationale.push(
      profile.goalFocus === "emergency_fund"
        ? "An emergency fund you cannot reach in a day is not an emergency fund."
        : "You need this money at short notice.",
    );
  } else if (profile.liquidityNeed === "near_term") {
    drop((entry) => entry.lock === "long", "it ties the money up for years");
  }

  if (profile.riskComfort === "low") {
    drop((entry) => entry.movesWithMarket, "its value can fall as well as rise");
    rationale.push("You said you are not comfortable watching the value fall.");
  }

  const recommendedProducts = (kept.length > 0 ? kept : SAFE_AND_REACHABLE).map(
    (entry) => entry.name,
  );

  if (kept.length === 0) {
    rationale.push("Nothing in that band fits your answers, so this falls back to plain savings.");
  }

  return {
    recommendedProducts,
    warnings,
    rationale: profile.guidanceLevel === "starter" ? rationale.slice(0, 1) : rationale,
    removals: profile.guidanceLevel === "detailed" ? removals : [],
    shouldPrioritizeEmergencyFund,
    shouldPrioritizeDebtRepayment,
  };
}
