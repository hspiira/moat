"use client";

import type { DebtPayoffStrategy } from "@/lib/domain/debt";

const DEBT_PLANNER_KEY = "moat.debt-planner-settings";

export type DebtPlannerSettings = {
  strategy: DebtPayoffStrategy;
  extraMonthlyPayment: number;
};

export function readDebtPlannerSettings(): DebtPlannerSettings {
  if (typeof window === "undefined") {
    return { strategy: "avalanche", extraMonthlyPayment: 0 };
  }

  try {
    const raw = window.localStorage.getItem(DEBT_PLANNER_KEY);
    if (!raw) return { strategy: "avalanche", extraMonthlyPayment: 0 };
    const parsed = JSON.parse(raw) as Partial<DebtPlannerSettings>;
    return {
      strategy: parsed.strategy === "snowball" ? "snowball" : "avalanche",
      extraMonthlyPayment:
        typeof parsed.extraMonthlyPayment === "number" ? parsed.extraMonthlyPayment : 0,
    };
  } catch {
    return { strategy: "avalanche", extraMonthlyPayment: 0 };
  }
}

export function saveDebtPlannerSettings(settings: DebtPlannerSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEBT_PLANNER_KEY, JSON.stringify(settings));
}
