import type { BudgetEnvelope } from "@/lib/domain/budgets";

export type EnvelopeStatus = "on_track" | "near_limit" | "overspent";

const NEAR_LIMIT_FRACTION = 0.85;

export type EnvelopeProgress = {
  fraction: number;
  status: EnvelopeStatus;
  overspentBy: number;
};

export function getEnvelopeProgress(envelope: BudgetEnvelope): EnvelopeProgress {
  const { allocated, spent } = envelope;
  const overspentBy = Math.max(0, spent - allocated);

  if (allocated <= 0) {
    return {
      fraction: spent > 0 ? 1 : 0,
      status: spent > 0 ? "overspent" : "on_track",
      overspentBy,
    };
  }

  const ratio = spent / allocated;

  return {
    fraction: Math.min(1, Math.max(0, ratio)),
    status: overspentBy > 0 ? "overspent" : ratio >= NEAR_LIMIT_FRACTION ? "near_limit" : "on_track",
    overspentBy,
  };
}

export type BudgetMonthPosition = {
  allocated: number;
  spent: number;
  remaining: number;
  overspentCount: number;
  unallocatedIncome: number;
};

export function getBudgetMonthPosition(
  envelopes: BudgetEnvelope[],
  capacity: { inflow: number; allocated: number; unallocatedIncome: number },
): BudgetMonthPosition {
  const allocated = envelopes.reduce((sum, envelope) => sum + envelope.allocated, 0);
  const spent = envelopes.reduce((sum, envelope) => sum + envelope.spent, 0);

  return {
    allocated,
    spent,
    remaining: allocated - spent,
    overspentCount: envelopes.filter((envelope) => envelope.isOverspent).length,
    unallocatedIncome: capacity.unallocatedIncome,
  };
}
